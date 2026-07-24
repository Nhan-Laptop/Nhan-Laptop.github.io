---
date: 2026-07-24
summary: Notes on PKEET, its two adversary models, and a standard-model construction from two-level HIBE, one-time signatures, and hashing.
tags:
  - cryptography
  - pkeet
  - hibe
  - cca2
---

# Public-Key Encryption with Equality Test

Public-key encryption with equality test (PKEET) lets an authorized tester decide whether two ciphertexts hide the same plaintext, even when the ciphertexts were created under different public keys. The tester learns the equality relation, but should not learn the plaintexts themselves.

This note studies the generic standard-model construction of Lee, Ling, Seo, Wang, and Youn. Its main ingredients are a two-level HIBE scheme, a strongly unforgeable one-time signature, and a cryptographic hash function.

## 1. Motivation and unavoidable leakage

Suppose two users encrypt records before sending them to a server. Ordinary randomized public-key encryption hides equality: encrypting the same message twice normally gives unrelated ciphertexts. PKEET adds controlled comparison:

```text
ct_i = Enc(pk_i, M_i) ──┐
                        ├── Test(td_i, td_j, ct_i, ct_j) ∈ {0, 1}
ct_j = Enc(pk_j, M_j) ──┘
```

The test result reveals whether $M_i=M_j$, but not the messages directly.

This functionality has an important cost. A tester with the target user's trapdoor can encrypt guesses under a public key and compare them with the target ciphertext. Therefore, low-entropy messages such as short status codes or values from a small dictionary are vulnerable to exhaustive guessing. The usual Type-I security model consequently asks only for one-way security and assumes a sufficiently large, high-min-entropy message distribution.

## 2. PKEET syntax

A PKEET scheme consists of six probabilistic polynomial-time algorithms:

1. **Setup**

   $$pp \leftarrow Setup(1^\lambda)$$

   It generates public parameters for security parameter $\lambda$. The message space $\mathcal{M}$ is included in, or determined by, $pp$.

2. **Key generation**

   $$(pk_i,sk_i)\leftarrow KeyGen(pp)$$

   Each user $U_i$ receives a public/secret key pair.

3. **Encryption**

   $$ct_i\leftarrow Enc(pk_i,M_i)$$

4. **Decryption**

   $$M_i'\leftarrow Dec(sk_i,ct_i)$$

   The result is a message or $\perp$.

5. **Trapdoor generation**

   $$td_i\leftarrow Td(sk_i)$$

6. **Equality test**

   $$Test(td_i,td_j,ct_i,ct_j)\rightarrow\{0,1\}$$

   The algorithm returns $1$ when the ciphertexts are judged to encrypt the same message.

### Correctness

For honestly generated keys and ciphertexts, a correct PKEET scheme must satisfy three properties.

First, ordinary decryption recovers the message:

$$
\Pr[Dec(sk_i,Enc(pk_i,M_i))=M_i]=1.
$$

Second, equal messages test equal, including across different users:

$$
M_i=M_j
\quad\Longrightarrow\quad
\Pr[Test(td_i,td_j,ct_i,ct_j)=1]=1.
$$

Third, unequal messages produce a false positive only with negligible probability:

$$
M_i\ne M_j
\quad\Longrightarrow\quad
\Pr[Test(td_i,td_j,ct_i,ct_j)=1]\leq \operatorname{negl}(\lambda).
$$

The third property is where collision resistance of the hash function will be used.

## 3. Building blocks

### 3.1 Two-level HIBE

For the full HIBE background, see my [IBE and HIBE notes](learning-IBE-HIBE.html). Here we need the following interface:

$$
\begin{aligned}
(mpk,msk) &\leftarrow HIBE.Setup(1^\lambda,1^2),\\
sk_{ID'} &\leftarrow HIBE.KeyExt(sk_{ID},ID'),\\
C &\leftarrow HIBE.Enc(mpk,ID,M),\\
M' &\leftarrow HIBE.Dec(sk_{ID},C).
\end{aligned}
$$

An identity $[ID_1.ID_2]$ has two levels. A secret key for the prefix $[ID_1]$ can derive keys for all descendants $[ID_1.ID_2]$, but not for a different first-level branch.

The construction reserves two branches:

```text
root
├── [0]
│   └── [0.vk]  encrypts M
└── [1]
    └── [1.vk]  encrypts H(M)
```

The level-one key for branch $[1]$ will become the equality-test trapdoor.

### 3.2 Strongly unforgeable one-time signatures

Let

$$Sig=(Sig.KGen,Sig.Sign,Sig.Verify).$$

The algorithms are:

$$
\begin{aligned}
(vk_s,sk_s)&\leftarrow Sig.KGen(1^\lambda),\\
\sigma&\leftarrow Sig.Sign(sk_s,m),\\
b&\leftarrow Sig.Verify(vk_s,m,\sigma).
\end{aligned}
$$

Strong unforgeability is stricter than ordinary existential unforgeability. After seeing a signature on $m$, the adversary must be unable to create any new valid message-signature pair, including a different valid signature on the same message.

Only one ciphertext is signed under each ephemeral verification key, so a one-time signature is sufficient.

### 3.3 Hash function

We use

$$H:\mathcal{M}\rightarrow\mathcal{M}_{HIBE}.$$

The hash must be:

- collision-resistant for equality-test correctness; and
- one-way for Type-I security, because the tester can recover $H(M)$.

### 3.4 The CHK idea

The Canetti–Halevi–Katz transformation turns selectively secure identity-based encryption into CCA-secure public-key encryption:

1. generate a fresh one-time signature key pair;
2. use the verification key as the encryption identity;
3. sign the resulting ciphertext.

If an attacker modifies a challenge ciphertext while keeping the same verification key, the modified ciphertext needs a fresh valid signature. If it uses another verification key, the simulator can request the corresponding HIBE secret key because that identity is not the selectively committed challenge identity.

PKEET applies this idea to both branches $[0.vk_s]$ and $[1.vk_s]$.

## 4. Security models

PKEET is a multi-user primitive. Let $t$ be the target user's index. The adversary may interact with:

- $O^{sk}(i)$, which returns $sk_i$;
- $O^{Dec}(i,ct)$, which returns $Dec(sk_i,ct)$; and
- $O^{Td}(i)$, which returns $td_i$.

The target secret key may not be requested, and the challenge pair $(t,ct_t^*)$ may not be submitted to the decryption oracle.

### 4.1 Type-I: OW-CCA2

A Type-I adversary may obtain $td_t$, so it can perform equality tests involving the challenge ciphertext. Indistinguishability is impossible in this setting: given candidate messages, the adversary can encrypt and test them.

The challenger instead samples a hidden message $M^*$, gives

$$ct_t^*\leftarrow Enc(pk_t,M^*),$$

and the adversary wins by outputting $M'=M^*$.

Using the baseline-adjusted convention from these notes:

$$
Adv_{\mathcal{A}}^{OW\text{-}CCA2}(\lambda)
=
\left|
\Pr[M'=M^*]-\frac{1}{|\mathcal{M}|}
\right|.
$$

The target trapdoor query is allowed, but the target secret-key query and direct decryption of $ct_t^*$ are forbidden.

### 4.2 Type-II: IND-CCA2

A Type-II adversary does not receive $td_t$. It chooses equal-length messages $M_0,M_1$. The challenger samples $b\leftarrow\{0,1\}$ and returns:

$$ct_t^*\leftarrow Enc(pk_t,M_b).$$

The adversary outputs $b'$ and has advantage

$$
Adv_{\mathcal{A}}^{IND\text{-}CCA2}(\lambda)
=
\left|
\Pr[b'=b]-\frac12
\right|.
$$

Queries $O^{sk}(t)$, $O^{Td}(t)$, and $O^{Dec}(t,ct_t^*)$ are forbidden.

## 5. Generic PKEET construction

Let:

- $HIBE=(HIBE.Setup,HIBE.KeyExt,HIBE.Enc,HIBE.Dec)$ be a two-level HIBE scheme;
- $Sig=(Sig.KGen,Sig.Sign,Sig.Verify)$ be a strongly unforgeable one-time signature; and
- $H$ be the hash function described above.

To avoid confusing a user's secret key with an HIBE identity key, this section writes a user's PKEET secret key as $msk_i$ and an identity secret key as $d_{i,ID}$.

### 5.1 Setup

$$pp\leftarrow Setup(1^\lambda)$$

Publish descriptions and compatible parameters for $HIBE$, $Sig$, $H$, and the message space.

### 5.2 Key generation

For user $U_i$, run:

$$
(mpk_i,msk_i)\leftarrow HIBE.Setup(1^\lambda,1^2).
$$

Set:

$$pk_i=mpk_i,\qquad sk_i=msk_i.$$

### 5.3 Encryption

To encrypt $M$ under $pk_i=mpk_i$:

1. Generate an ephemeral signature key pair:

   $$
   (vk_s,sk_s)\leftarrow Sig.KGen(1^\lambda).
   $$

2. Encrypt the message on branch $0$:

   $$
   C_0\leftarrow HIBE.Enc(mpk_i,[0.vk_s],M).
   $$

3. Encrypt its hash on branch $1$:

   $$
   C_1\leftarrow HIBE.Enc(mpk_i,[1.vk_s],H(M)).
   $$

4. Bind the two components:

   $$
   \sigma\leftarrow Sig.Sign(sk_s,C_0\mathbin\Vert C_1).
   $$

5. Output:

   $$
   ct=(vk_s,C_0,C_1,\sigma).
   $$

### 5.4 Decryption

Given $sk_i=msk_i$ and $ct=(vk_s,C_0,C_1,\sigma)$:

1. Reject if

   $$
   Sig.Verify(vk_s,C_0\mathbin\Vert C_1,\sigma)=0.
   $$

2. Derive the two identity keys:

   $$
   \begin{aligned}
   d_{i,[0.vk_s]}&\leftarrow HIBE.KeyExt(msk_i,[0.vk_s]),\\
   d_{i,[1.vk_s]}&\leftarrow HIBE.KeyExt(msk_i,[1.vk_s]).
   \end{aligned}
   $$

3. Decrypt:

   $$
   \begin{aligned}
   M'&\leftarrow HIBE.Dec(d_{i,[0.vk_s]},C_0),\\
   h'&\leftarrow HIBE.Dec(d_{i,[1.vk_s]},C_1).
   \end{aligned}
   $$

4. Return the recovered message when the hash check succeeds:

   $$
   H(M')=h'.
   $$

   Otherwise, return $\perp$.

The signature prevents mixing or modifying $C_0$ and $C_1$, while the hash check ensures that they encode consistent values.

### 5.5 Trapdoor generation

Derive the level-one key for branch $[1]$:

$$
td_i=d_{i,[1]}\leftarrow HIBE.KeyExt(msk_i,[1]).
$$

This key can derive $d_{i,[1.vk_s]}$ for any second-level verification key, but it cannot derive a key on branch $[0]$. Consequently, it exposes the hash component needed for testing without exposing the message component.

### 5.6 Equality test

Given $td_i,td_j$ and:

$$
\begin{aligned}
ct_i&=(vk_{s,i},C_{i,0},C_{i,1},\sigma_i),\\
ct_j&=(vk_{s,j},C_{j,0},C_{j,1},\sigma_j),
\end{aligned}
$$

derive:

$$
\begin{aligned}
d_{i,[1.vk_{s,i}]}&\leftarrow
HIBE.KeyExt(td_i,vk_{s,i}),\\
d_{j,[1.vk_{s,j}]}&\leftarrow
HIBE.KeyExt(td_j,vk_{s,j}).
\end{aligned}
$$

Then recover:

$$
\begin{aligned}
h_i&\leftarrow HIBE.Dec(d_{i,[1.vk_{s,i}]},C_{i,1}),\\
h_j&\leftarrow HIBE.Dec(d_{j,[1.vk_{s,j}]},C_{j,1}).
\end{aligned}
$$

Return $1$ if $h_i=h_j$, and $0$ otherwise.

For honest ciphertexts:

$$
h_i=h_j
\quad\Longleftrightarrow\quad
H(M_i)=H(M_j).
$$

Thus equal messages always match, while unequal messages match only when they cause a hash collision.

## 6. Security analysis

The complete reductions are lengthy, but their structure is more important than the bookkeeping constants.

### 6.1 IND-CCA2 against Type-II adversaries

**Theorem 2.** If the two-level HIBE scheme is IND-sID-CPA secure and the one-time signature is strongly unforgeable, then the PKEET construction is IND-CCA2 secure against Type-II adversaries.

Using the notation:

- $\epsilon_{HIBE}$ for the best relevant HIBE distinguishing advantage; and
- $\epsilon_{Sig}$ for the best strong one-time-signature forgery advantage,

the proof in these notes gives:

$$
Adv_{\mathcal{A}}^{IND\text{-}CCA2}
\leq
2\epsilon_{HIBE}+\frac32\epsilon_{Sig}.
$$

#### Game 0: the real experiment

The challenge ciphertext is:

$$
ct_t^*=
(vk_s^*,C_{0,b}^*,C_{1,b}^*,\sigma^*),
$$

where:

$$
\begin{aligned}
C_{0,b}^*&\leftarrow HIBE.Enc(mpk_t,[0.vk_s^*],M_b),\\
C_{1,b}^*&\leftarrow HIBE.Enc(mpk_t,[1.vk_s^*],H(M_b)).
\end{aligned}
$$

#### Game 1: abort on a same-key forgery

Define the bad event $E_{sig}$: the adversary submits a new valid ciphertext to the target decryption oracle with verification key $vk_s^*$.

The query cannot equal the challenge ciphertext itself. Therefore, if it verifies, it contains a new valid signature pair under the one-time verification key. Strong unforgeability gives:

$$
\Pr[E_{sig}]\leq\epsilon_{Sig}.
$$

<figure class="proof-figure">
  <a href="../assets/pkeet/figure-1-signature-forgery.png">
    <img src="../assets/pkeet/figure-1-signature-forgery.png" width="1278" height="1051" loading="lazy" alt="Reduction from a same-verification-key decryption query to a strong one-time-signature forgery">
  </a>
  <figcaption>Figure 1. The simulator embeds the signature challenge verification key in the PKEET challenge. A valid same-key decryption query that triggers the bad event becomes a strong-unforgeability forgery.</figcaption>
</figure>

Conditioned on $\neg E_{sig}$, Games 0 and 1 are identical. The proof's probability accounting yields:

$$
\epsilon_0-\epsilon_1
\leq
\frac32\epsilon_{Sig}.
$$

This is the exact point at which **strong** unforgeability matters: merely changing the signature on the same $(C_0,C_1)$ must also be infeasible.

#### Game 2: decouple the two branches

Game 2 replaces one HIBE component so that the two branches no longer consistently encode the same challenge bit. A simulator chooses one of the identities:

$$[0.vk_s^*]\qquad\text{or}\qquad[1.vk_s^*]$$

as its selective HIBE target. It embeds the HIBE challenge in that branch and generates the other branch normally.

<figure class="proof-figure">
  <a href="../assets/pkeet/figure-2-hibe-lemma2.png">
    <img src="../assets/pkeet/figure-2-hibe-lemma2.png" width="1278" height="909" loading="lazy" alt="HIBE simulator used to move from Game 1 to Game 2">
  </a>
  <figcaption>Figure 2. The HIBE simulator commits to one of the two branch identities, embeds the HIBE challenge in that branch, and constructs the other component normally.</figcaption>
</figure>

If the adversary notices the transition, the simulator distinguishes the HIBE challenge. Accounting for the randomly selected branch gives:

$$
\epsilon_1-\epsilon_2\leq2\epsilon_{HIBE}.
$$

In the final game, the hidden switch makes the adversary's view independent of the challenge bit, so:

$$\epsilon_2=0.$$

Combining the transitions proves the stated bound.

### 6.2 OW-CCA2 against Type-I adversaries

**Theorem 3.** If HIBE is IND-sID-CPA secure, $H$ is one-way, and the one-time signature is strongly unforgeable, then the PKEET construction is OW-CCA2 secure against Type-I adversaries.

Let $\epsilon_H$ denote the best advantage against the one-wayness of $H$. The proof gives:

$$
Adv_{\mathcal{A}}^{OW\text{-}CCA2}
\leq
4\epsilon_{HIBE}+\epsilon_H+\epsilon_{Sig}.
$$

The Type-I proof first isolates the information exposed by the hash branch. In the pre-simulation, the hash challenger supplies a value $y=H(x)$. The simulator places $y$ in the second HIBE ciphertext component and uses a successfully recovered plaintext as a candidate preimage.

<figure class="proof-figure">
  <a href="../assets/pkeet/figure-3-hash-presimulation.png">
    <img src="../assets/pkeet/figure-3-hash-presimulation.png" width="1278" height="1207" loading="lazy" alt="Pre-simulation reduction from PKEET message recovery to one-wayness of the hash function">
  </a>
  <figcaption>Figure 3. The pre-simulation embeds the one-way hash challenge in the equality-test branch and checks whether the adversary returns a valid preimage.</figcaption>
</figure>

The anomalous challenge used later in the game follows the same idea in a smaller experiment: the message branch encrypts an independently sampled value, while the hash branch contains the challenge value $y$.

<figure class="proof-figure">
  <a href="../assets/pkeet/figure-4-hash-one-way.png">
    <img src="../assets/pkeet/figure-4-hash-one-way.png" width="1278" height="881" loading="lazy" alt="Direct reduction from an anomalous PKEET challenge to one-wayness of the hash function">
  </a>
  <figcaption>Figure 4. If the adversary recovers a message whose hash is the embedded challenge value, the simulator wins the hash one-wayness game.</figcaption>
</figure>

The main simulation then embeds a selectively chosen HIBE identity in the message branch and uses the adversary's message-recovery result to distinguish the underlying HIBE challenge.

<figure class="proof-figure">
  <a href="../assets/pkeet/figure-5-hibe-theorem3.png">
    <img src="../assets/pkeet/figure-5-hibe-theorem3.png" width="1278" height="1504" loading="lazy" alt="Main HIBE simulation in the OW-CCA2 proof for a Type-I adversary">
  </a>
  <figcaption>Figure 5. Main HIBE simulation for Theorem 3. The target user's trapdoor queries remain answerable through the level-one key for branch 1.</figcaption>
</figure>

At a high level, the proof proceeds as follows:

1. abort if the adversary creates a new valid ciphertext under $vk_s^*$;
2. reduce that event to strong signature unforgeability;
3. embed an HIBE challenge in the message branch; and
4. show that recovering the message from the remaining hash value in the final game inverts $H$.

The factor $4$ comes from the simulator's guesses and the conversion between the adversary's message-recovery probability and its HIBE distinguishing advantage. The security meaning is simpler than the constant: every non-negligible Type-I attack yields either an HIBE distinguisher, a hash inverter, or a signature forger.

## 7. What the construction does and does not hide

The tester learns:

- whether tested ciphertexts encrypt equal messages;
- repeated-equality patterns across users who provided trapdoors; and
- enough capability to run a dictionary attack when the message distribution is small.

The tester should not learn:

- the plaintext component $M$ directly, because $td_i$ is restricted to branch $[1]$;
- arbitrary HIBE keys on branch $[0]$; or
- a way to modify the challenge ciphertext into another valid ciphertext under the same one-time verification key.

PKEET is therefore appropriate only when equality leakage is explicitly acceptable and the message distribution has enough entropy. Authorization of the test operation is not a substitute for analyzing this leakage.

## 8. Takeaways

The construction separates two roles:

$$
\begin{array}{c|c|c}
\text{Branch} & \text{Encrypted value} & \text{Who can recover it}\\
\hline
[0.vk_s] & M & \text{user with }msk\\
[1.vk_s] & H(M) & \text{user or authorized tester}
\end{array}
$$

The two HIBE ciphertexts provide confidentiality and controlled delegation. The one-time signature upgrades the construction to resist adaptive ciphertext modification. The hash makes equality testing possible without handing the tester the message-decryption branch.

The resulting guarantees are deliberately asymmetric:

- a tester with the target trapdoor receives OW-CCA2 security; and
- an adversary without that trapdoor receives IND-CCA2 security.

## References

1. H. T. Lee, S. Ling, J. H. Seo, H. Wang, and T. Y. Youn, [Public Key Encryption with Equality Test in the Standard Model](https://doi.org/10.1016/j.ins.2019.12.023), *Information Sciences*, 516, 89–108, 2020.
2. R. Canetti, S. Halevi, and J. Katz, [Chosen-Ciphertext Security from Identity-Based Encryption](https://eprint.iacr.org/2003/182), 2003; journal version with D. Boneh, *SIAM Journal on Computing*, 2006.
3. D. Boneh and X. Boyen, [Efficient Selective-ID Secure Identity-Based Encryption Without Random Oracles](https://crypto.stanford.edu/~xb/eurocrypt04b/), EUROCRYPT 2004.
4. D. Boneh, E. Shen, and B. Waters, [Strongly Unforgeable Signatures Based on Computational Diffie-Hellman](https://crypto.stanford.edu/~dabo/pubs/abstracts/strongsigs.html), PKC 2006.
