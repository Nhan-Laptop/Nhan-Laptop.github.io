---
date: 2026-07-13
summary: Recovering the xoshiro256** state behind a web-exposed .NET Random token stream and forging future Base64 tokens.
tags:
  - web
  - prng
  - state-recovery
  - xoshiro256starstar
---

# r3ctf 2026 — Breaking Random

**Category:** Web

## Description
> Original organizer description was not provided in the available artifacts.

## Overview
The web challenge exposes `NextWeakBase64()`, a token generator that returns `Base64(ASCII(str(_random.Next(0, 2147483647))))`. Once those tokens are decoded, the problem reduces to recovering the internal state of `.NET Random`, which here is xoshiro256** plus the bounded-output logic used by `Next(int maxValue)`. The solve path is: turn each observed integer into 46 candidates for a 32-bit slice of `s1`, use 9 consecutive outputs to build a linear system over `GF(2)`, recover the 256-bit state up to 6 kernel bits, then verify the correct state against the longer stream and predict future `NextWeakBase64()` values.

## Technical details
The user-provided challenge primitive is:

```csharp
private string NextWeakBase64()
{
    string text = _random.Next(0, 2147483647).ToString((IFormatProvider)(object)CultureInfo.InvariantCulture);
    return Convert.ToBase64String(Encoding.ASCII.GetBytes(text));
}
```

So each token is

$$
\text{token}_t = \operatorname{Base64}(\operatorname{ASCII}(\operatorname{str}(Y_t))),
$$

where \(Y_t = \texttt{Random.Next}(0, 2^{31}-1)\). The `values` array in `tmp.py` is the decoded integer stream.

In the bounded generator reproduced by `predict`, let

$$
M = 2^{31}-1,\qquad Z_t = \operatorname{high}_{32}(R_t),
$$

where \(R_t\) is the 64-bit xoshiro256** output. The `.NET` bounded conversion is

$$
Y_t = \left\lfloor \frac{M Z_t}{2^{32}} \right\rfloor.
$$

Because the rejection threshold is

$$
(2^{32} \bmod M) = 2,
$$

only values satisfying

$$
\operatorname{low}_{32}(M Z_t) \ge 2
$$

are accepted. This is exactly what `get_z_candidates` implements:

```python
def get_z_candidates(y):
    lo = (y * mod32 + ma_vl - 1) // ma_vl
    hi = (((y + 1) * mod32 - 1) // ma_vl)
    ...
    if ((ma_vl * z) & mask32) >= 2:
        out.append(z)
```

For this dataset, every observed \(Y_t\) has exactly two valid \(Z_t\) candidates.

The xoshiro256** output function in `xoshiro` is

$$
R_t = 9 \cdot \operatorname{rotl}_{64}(5 s_{1,t}, 7) \bmod 2^{64}.
$$

Write

$$
x_t = (s_{1,t} \gg 25) \bmod 2^{32},
$$

which is the 32-bit slice extracted by `shift_25`. Using half-open indexing, this is the bit range \([25,57)\), i.e. bits \(25\) through \(56\).

Let

$$
A_t = 5 s_{1,t} \bmod 2^{64},\qquad B_t = \operatorname{rotl}_{64}(A_t, 7).
$$

Since `rotl64` shifts bit \(i\) of \(A_t\) to bit \(i+7 \bmod 64\), the upper 32 bits of \(B_t\) are exactly the slice \([25,57)\) of \(A_t\). If we split \(s_{1,t}\) as

$$
s_{1,t} = \ell_t + 2^{25} x_t + 2^{57} h_t,\qquad 0 \le \ell_t < 2^{25},
$$

then

$$
\left(\frac{A_t}{2^{25}}\right) \bmod 2^{32} = 5x_t + c_{5,t} \pmod{2^{32}},
$$

with carry

$$
c_{5,t} = \left\lfloor \frac{5\ell_t}{2^{25}} \right\rfloor \in \{0,1,2,3,4\}.
$$

This is the first place where the notebook needed a correction: the carry for multiplication by \(5\) comes from the lower 25 bits, so the divisor is \(2^{25}\), not \(2^{32}\).

Now split \(B_t\) into 32-bit halves:

$$
B_t = b_t + 2^{32} u_t,\qquad u_t = \operatorname{high}_{32}(B_t).
$$

Then

$$
Z_t = \operatorname{high}_{32}(9 B_t) = 9u_t + c_{9,t} \pmod{2^{32}},
$$

where

$$
c_{9,t} = \left\lfloor \frac{9b_t}{2^{32}} \right\rfloor \in \{0,\dots,8\}.
$$

Since \(u_t = 5x_t + c_{5,t} \pmod{2^{32}}\), we get

$$
Z_t = 45x_t + k_t \pmod{2^{32}},
$$

with

$$
k_t = 9c_{5,t} + c_{9,t} \in \{0,\dots,44\}.
$$

Therefore, once `get_z_candidates` gives the two possible \(Z_t\) values, `cal_x` can invert the affine relation with \(45^{-1} \bmod 2^{32}\):

```python
def cal_x(y):
    vals = set()
    for z in get_z_candidates(y):
        for k in range(45):
            x = (inv45 * ((z - k) & mask32)) & mask32
            vals.add(x)
    return sorted(vals)
```

For every sample in the provided stream, `cal_x` returns exactly 46 slice candidates. This is consistent with the two consecutive \(Z_t\) values and the overlap between the two 45-element candidate sets.

The next step uses the fact that the xoshiro256** state transition is linear over \(GF(2)\). This applies only to the state update:

$$
(s_0,s_1,s_2,s_3) \mapsto (s_0',s_1',s_2',s_3'),
$$

because it is composed only of XORs, shifts, and rotations. It does not apply to the nonlinear output map \(s_1 \mapsto 9 \cdot \operatorname{rotl}(5s_1,7)\). In `tmp.py`, `build_linear_equations_The_matrix_of_equations` uses `xoshiro(state)` only to advance the state and ignores the returned `result`.

Let \(S_t \in GF(2)^{256}\) be the concatenation of \((s_0,s_1,s_2,s_3)\), and let \(T\) be the linear transition matrix for one step. Let \(P\) be the projection that extracts the 32-bit slice used by `shift_25`. Then

$$
S_{t+1} = T S_t,\qquad x_t = P S_t.
$$

Stacking 9 consecutive slices gives

$$
X =
\begin{bmatrix}
x_0 \\
x_1 \\
\vdots \\
x_8
\end{bmatrix}
=
M S_0,
\qquad
M =
\begin{bmatrix}
P \\
PT \\
\vdots \\
PT^8
\end{bmatrix}
\in GF(2)^{288 \times 256}.
$$

This is exactly the matrix built by `build_linear_equations_The_matrix_of_equations`. On the provided stream, the script reports

$$
\operatorname{rank}(M) = 250.
$$

That immediately gives two useful dimensions:

$$
\dim(\ker(M^\top)) = 288 - 250 = 38,
$$

and

$$
\dim(\ker(M)) = 256 - 250 = 6.
$$

The 38 left-kernel vectors are extracted by `find_dependency_vector`. For every valid slice tuple \((x_0,\dots,x_8)\), they impose parity constraints

$$
d^\top X = 0.
$$

`choose_sum_0_by_dependency_vector` maps each candidate slice to its 38-bit syndrome contribution. The correct 9-tuple must satisfy

$$
\sigma_0(x_0)\oplus \sigma_1(x_1)\oplus \cdots \oplus \sigma_8(x_8)=0.
$$

Brute-forcing all \(46^9\) tuples is too large, so `build_left_table_py` and `mitm_indices_mp` use meet-in-the-middle: split the 9 outputs as \(4+5\), store all \(46^4\) left syndromes, and scan the \(46^5\) right syndromes for collisions. In the recorded run, the left table had 4,477,424 unique syndromes.

Once a valid slice tuple is found, `state_from_slices` reconstructs one solution \(S_0\), and `find_the_best_conbination` returns the 6 kernel basis vectors in `tmp9`. Enumerating those \(2^6 = 64\) possibilities and checking them with `matches_outputs` against the full stream yields the unique correct state:

```text
s0 = 0x22118258a9d111a0
s1 = 0x346edce5f713f8ed
s2 = 0x1e9a57bc80e6721d
s3 = 0x2d160e7e5c3f42ca
```

At that point, predicting future challenge values is trivial: use `generate_values` to obtain future \(Y_t\), then serialize each one as `Base64(ASCII(str(Y_t)))` to match `NextWeakBase64()`.

## Proof-of-Concept
1. Decode each challenge token from Base64 into an ASCII decimal integer.
   The solver already stores the recovered sequence as `values` in `tmp.py`, so the rest of the attack works directly on those integers.

2. Recover the two valid 32-bit `z` values behind each bounded output with `get_z_candidates`.
   Use

   $$
   \left\lceil \frac{Y_t 2^{32}}{M} \right\rceil \le Z_t \le \left\lfloor \frac{(Y_t+1)2^{32}-1}{M} \right\rfloor,
   $$

   then keep only the candidates satisfying \(\operatorname{low}_{32}(MZ_t)\ge 2\).
   For this stream, every sample yields exactly two `z` values.

3. Lift each observed output to 46 candidates for the internal slice \(x_t = (s_{1,t} \gg 25)\bmod 2^{32}\) with `cal_x`.
   The inversion formula is

   $$
   x_t = 45^{-1}(Z_t-k_t) \pmod{2^{32}},\qquad k_t\in\{0,\dots,44\}.
   $$

   The script confirms `[46, 46, ..., 46]` on the first 10 outputs.

4. Build the 288-by-256 observation matrix with `build_linear_equations_The_matrix_of_equations(9)`.
   This models 9 consecutive 32-bit slices as linear observations of the initial 256-bit state. The measured rank is 250, so the left kernel has dimension 38 and the solution space has 6 free state bits.

5. Convert the 38 dependencies into a 38-bit syndrome table with `choose_sum_0_by_dependency_vector`, then solve the zero-sum condition with the meet-in-the-middle code in `build_left_table_py` and `mitm_indices_mp`.
   This avoids brute-forcing \(46^9\) slice tuples directly.

6. Reconstruct the initial state with `state_from_slices`, enumerate the 64 kernel offsets from `tmp9`, and validate the real state with `matches_outputs`.
   Running the provided solver with PyPy:

   ```text
   /opt/pypy3.10/bin/pypy3.10 tmp.py
   dependencies: 38
   rank: 250
   tmp: 6
   left table size: 4477424
   recovered state:
       s0 = 0x22118258a9d111a0
       s1 = 0x346edce5f713f8ed
       s2 = 0x1e9a57bc80e6721d
       s3 = 0x2d160e7e5c3f42ca
   time: 3.4585907459259033 seconds
   ```

   The recovered state reproduces the observed stream exactly, so it is sufficient to predict all future outputs.

7. Generate future integers with `generate_values`, then encode them back to the challenge format:

   $$
   \text{token}_t = \operatorname{Base64}(\operatorname{ASCII}(\operatorname{str}(Y_t))).
   $$

   This forges future `NextWeakBase64()` values without needing any further interaction with the target RNG.

