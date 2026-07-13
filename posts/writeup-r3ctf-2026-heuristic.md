---
date: 2026-07-13
summary: Recovering a hidden CKKS scaling factor from one chosen-plaintext ciphertext and 96 bounded-noise coefficient leaks.
tags:
  - crypto
  - ckks
  - chosen-plaintext
  - recurrence
---

# r3ctf 2026 — HEuristic

**Category:** Crypto

## Description

> The original organizer description was not provided with the local artifacts.

## Overview

HEuristic wraps Microsoft SEAL's CKKS implementation in a custom encryption and decryption service. It multiplies every attacker-controlled plaintext coefficient by one secret scalar, Δ, then leaks 96 decrypted coefficients with bounded noise. A geometric chosen plaintext cancels Δ from adjacent leaks, producing a contracting recurrence that recovers the noise and then Δ exactly.

## Technical details

### Oracle model

The service configures CKKS with polynomial degree N = 4096 and five 48-bit coefficient moduli:

```cpp
parms.set_poly_modulus_degree(4096);
parms.set_coeff_modulus(CoeffModulus::Create(4096, {48, 48, 48, 48, 48}));
```

At the first data level, the active coefficient moduli produce the 192-bit modulus

$$
q = 6277101715473810179849235372514429772715831797744269418497.
$$

The service samples one secret Δ in {1, ..., q - 1}. For every coefficient supplied to the encryption oracle, it checks

```cpp
cpp_int reduced = coeff % q;
cpp_int abs_coeff = reduced > q / 2 ? q - reduced : reduced;
if (abs_coeff < q / 8) {
    throw std::invalid_argument("bad plaintext");
}
```

and embeds

$$
c_i \equiv p_i\Delta \pmod q
$$

before applying the NTT and calling SEAL's encryptor. Consequently, the attacker controls all 4096 values p_i, subject only to

$$
\min(p_i,q-p_i)\geq \frac q8.
$$

The decryption oracle performs the inverse NTT and CRT composition, but prints only the first 96 coefficients. Each visible value receives fresh signed noise:

```cpp
cpp_int noise_bound = cpp_int(5) << 185;
cpp_int noise = random_below(noise_bound, noise_rng);
value = (coeffs[i] ± noise) % q;
```

Writing B = 5 · 2^185, the leak is therefore

$$
y_i\equiv p_i\Delta+e_i\pmod q,
\qquad -(B-1)\leq e_i\leq B-1,
\qquad 0\leq i<96.
$$

This custom raw-coefficient interface is the weakness: a chosen plaintext and its noisy decryption can be queried under the same global multiplier.

### From the notebook's HNP attempt to a chosen recurrence

The initial `solve.ipynb` models each sample as

$$
e_i=y_i-p_i\Delta+k_iq,
$$

and tries a generic Hidden Number Problem lattice. That model misses the strongest capability in the service: p_i is chosen by the attacker. Moreover, Δ spans all nonzero residues modulo q, and the error already occupies about 188 bits against a 192-bit modulus.

Instead, choose adjacent coefficients with ratio four:

$$
p_{i+1}\equiv4p_i\pmod q.
$$

The corresponding leaks satisfy

$$
4y_i-y_{i+1}\equiv4e_i-e_{i+1}\pmod q.
$$

Define the centered residue

$$
d_i=\operatorname{center}(4y_i-y_{i+1}).
$$

This is an ordinary integer equality, not merely a congruence, because

$$
|4e_i-e_{i+1}|<5B<\frac q2.
$$

Thus

$$
d_i=4e_i-e_{i+1}
\quad\Longleftrightarrow\quad
e_i=\frac{e_{i+1}+d_i}{4}.
$$

Every backward step divides the uncertainty width by four. Ratios one and two only give total contractions of \(1\) and \(2^{95}\), respectively; ratio four gives

$$
4^{95}=2^{190}>2B,
$$

which is sufficient to isolate one value for \(e_0\).

### Satisfying the plaintext filter

The recurrence still needs 96 valid coefficients. Since this modulus has \(q\equiv1\pmod3\), choose

$$
p_0=3^{-1}\pmod q=\frac{2q+1}{3},
\qquad
p_i\equiv4^ip_0\pmod q.
$$

Because \(4^i\equiv1\pmod3\), a representative is

$$
p_i=\frac{2q+4^i}{3}.
$$

For \(0\leq i<96\), \(4^i\leq2^{190}<q/2\), so its centered magnitude is

$$
|p_i-q|=\frac{q-4^i}{3}>\frac q6>\frac q8.
$$

All 96 recurrence coefficients therefore pass the server's validation.

### Exact interval recovery

Start with the full possible interval for \(e_{95}\):

$$
[L_{95},U_{95}]=[-(B-1),B-1].
$$

Applying the recurrence backward gives

$$
L_i=\max\left(-(B-1),\left\lceil\frac{L_{i+1}+d_i}{4}\right\rceil\right),
$$

$$
U_i=\min\left(B-1,\left\lfloor\frac{U_{i+1}+d_i}{4}\right\rfloor\right).
$$

After 95 steps, \(L_0=U_0=e_0\). The secret follows from the first leaked equation:

$$
\Delta\equiv(y_0-e_0)p_0^{-1}\pmod q.
$$

The service allows only three menu choices, and the chain fits exactly: encrypt, decrypt, submit.

## Proof-of-Concept

1. Build the geometric prefix and fill the hidden suffix with any valid coefficients.

```python
N = 4096
BOUND = (5 << 185) - 1

p0 = pow(3, -1, q)
coeffs = [p0 * pow(4, i, q) % q for i in range(96)]
assert all(min(x, q - x) >= q // 8 for x in coeffs)

lo_valid = q // 8 + 100
hi_valid = 7 * q // 8 - 100
coeffs += [random.randint(lo_valid, hi_valid) for _ in range(96, N)]
```

Submitting `coeffs` to menu option `1` produces a ciphertext whose first 96 plaintext coefficients obey the required ratio. Sending that ciphertext unchanged to option `2` produces the noisy vector `ys`.

2. Eliminate Δ and extract the exact recurrence constants.

```python
def center(value, modulus):
    value %= modulus
    return value if value <= modulus // 2 else value - modulus

ds = [center(4 * ys[i] - ys[i + 1], q) for i in range(95)]
```

Each `ds[i]` is exactly 4e_i - e_{i+1}, so no modular ambiguity remains.

3. Propagate the bounded interval backward using integer floor and ceiling operations.

```python
def ceil_div(a, b):
    return -((-a) // b)

lo, hi = -BOUND, BOUND
for i in range(94, -1, -1):
    lo = max(-BOUND, ceil_div(lo + ds[i], 4))
    hi = min(BOUND, (hi + ds[i]) // 4)

assert lo == hi
e0 = lo
```

The resulting singleton is the exact first noise value. Using floating-point division here can move an endpoint and destroy the recovery; the floor and ceiling operations must remain integral.

4. Recover the multiplier and use the final menu round.

```python
delta = ((ys[0] - e0) * pow(p0, -1, q)) % q

io.sendlineafter(b"> ", b"3")
io.sendlineafter(b"delta> ", str(delta).encode())
print(io.recvline().decode().strip())
```

The submitted value equals the server's hidden Δ, so option `3` returns the flag.

## P/S

The notebook was useful for identifying the noisy congruence system and scripting both oracles, but its HNP path also contained provisional range assumptions that do not match the server. The final exploit uses the server code for the exact ranges and turns chosen-plaintext control into a deterministic recurrence attack.
