---
date: 2026-07-13
summary: Notes on IBE and HIBE security games, lattice sampling algorithms, and the trapdoor techniques behind hierarchical encryption.
tags:
  - lattice
  - ibe
  - hibe
  - trapdoors
---

# IBE-HIBE 

## **Security Game (INDr-sID-CPA)**

- **$\mathcal{M}_\lambda$**: Message space.   
- **$\mathcal{C}_\lambda$**: Ciphertext space.   

### **1. Init**

- The adversary is given the maximum depth of the hierarchy $d$.   
- The adversary outputs a target identity $id^* = (I_1^*, \dots, I_k^*)$ where $k \le d$.   

### **2. Setup**

- The challenger runs the algorithm $\text{Setup}(1^\lambda, 1^d)$ (Note: $d = 1$ for basic IBE).   
- The challenger gives the Public Parameters ($PP$) to the adversary and keeps the Master Key ($MK$) secret.   

### **3. Phase 1 (Private Key Queries)**

- **Queries:** The adversary issues queries $q_1, \dots, q_m$ to extract private keys for identities $id_i = (I_1, \dots, I_u)$ with $u \le d$.   

- **Constraint:** $id_i$ must not be a prefix of $id^*$. This means it cannot be the case that $u \le k$ and $I_j = I_j^*$ for all $j = 1, \dots, u$.   

- **Response:** The challenger runs the Extract algorithm to generate the private key $d_i$ and sends it to the adversary.   

- *Note on Adaptivity:* These queries can be adaptive, meaning the adversary can analyze previously received keys (from $q_1, \dots, q_{i-1}$) before making the next query.   
### **4. Challenge**

- The adversary outputs a target message $M \in \mathcal{M}_\lambda$.   
- The challenger picks a random bit $r \in \{0, 1\}$ and a uniformly random ciphertext $C \in \mathcal{C}_\lambda$.   
- If $r = 0$, the challenge ciphertext is $C^* = \text{Encrypt}(PP, id^*, M)$.   
- If $r = 1$, the challenge ciphertext is $C^* = C$.   
- The challenger sends $C^*$ to the adversary.   

### **5. Phase 2**

- The adversary issues additional adaptive queries $q_{m+1}, \dots, q_n$.   
- The same prefix constraint applies: no queried $id_i$ can be a prefix of $id^*$.   

###  **6. Guess**

- The adversary outputs a guess $r' \in \{0, 1\}$.   
- The adversary wins the game if $r = r'$

## **Sampling Algorithms**

- Let $A, B \in \mathbb{Z}_q^{n \times m}$ and $R \in \{-1, 1\}^{m \times m}$.  
- The construction matrices we work with have the form $F = (A \mid AR + B) \in \mathbb{Z}_q^{n \times 2m}$.  
- **Goal:** Sample short vectors $e$ such that $F \cdot e = u \pmod q$ (i.e., $e \in \Lambda_q^u(F)$).  
We can achieve this using a trapdoor for either the left or right side of $F$:

- **SampleLeft:** Uses a trapdoor $T_A$ for $\Lambda_q^\bot(A)$ to output a short vector $e$.  

- **SampleRight:** Uses a trapdoor $T_B$ for $\Lambda_q^\bot(B)$ to output a short vector $e$.  

- With appropriate parameters, the distributions of $e$ produced by these two algorithms are statistically indistinguishable.  

###  **Algorithm SampleLeft**
$\text{SampleLeft}(A, M_1, T_A, u, \sigma)$
**Inputs:**

- A rank $n$ matrix $A \in \mathbb{Z}_q^{n \times m}$ and a matrix $M_1 \in \mathbb{Z}_q^{n \times m_1}$ (Note: in our specific scheme, $M_1 = AR + B$).  
- A "short" basis $T_A$ for $\Lambda_q^\bot(A)$ (trapdoor) and a vector $u \in \mathbb{Z}_q^n$.  
- A Gaussian parameter $\sigma > \|\tilde{T}_A\| [cite_start]\cdot \omega(\sqrt{\log(m+m_1)})$.  

**Output:**

- Let $F_1 = (A \mid M_1)$.  
- Outputs a short vector $e \in \mathbb{Z}^{m+m_1}$ sampled from a distribution statistically close to $D_{\Lambda_q^u(F_1), \sigma}$ such that $F_1 \cdot e = u \pmod q$.  

**process**
1. Sample a random vector $e_2 \in \mathbb{Z}^{m_1}$ distributed statistically close to $D_{\mathbb{Z}^{m_1}, \sigma}$.  
2. Compute the target shift vector $y = u - (M_1 \cdot e_2) \in \mathbb{Z}_q^n$.  
3. Run $e_1 \leftarrow \text{SamplePre}(A, T_A, y, \sigma)$.  
4. Output $e = (e_1, e_2) \in \mathbb{Z}^{m+m_1}$.  
**POC:**

- We need to solve $F_1 \cdot e = u \pmod q$ where $e = (e_1, e_2)^T$ and $F_1 = (A \mid M_1)$.
- Expanding the equation gives: $F_1 \cdot e = A \cdot e_1 + M_1 \cdot e_2 = u \pmod q$.
- Step 1 samples $e_2$ independently. We then need to find $e_1$ such that $A \cdot e_1 = u - M_1 \cdot e_2 \pmod q$.
- Let $y = u - M_1 \cdot e_2$. The problem reduces to finding a short $e_1$ satisfying $A \cdot e_1 = y \pmod q$.
- Step 3 utilizes the trapdoor $T_A$ (which inherently satisfies $A \cdot T_A = 0 \pmod q$) via `SamplePre` to efficiently sample this short $e_1$.
- Finally, direct substitution proves correctness:

$$F_1 \cdot e = A \cdot e_1 + M_1 \cdot e_2 = y + M_1 \cdot e_2 = (u - M_1 \cdot e_2) + M_1 \cdot e_2 = u \pmod q$$

### **Algorithm SampleRight**
$\text{SampleRight}(A, B, R, T_B, u, \sigma)$
**Inputs:**

- Matrices $A \in \mathbb{Z}_q^{n \times k}$ and $B \in \mathbb{Z}_q^{n \times m}$ (where $B$ has rank $n$).  
- A matrix $R \in \mathbb{Z}^{k \times m}$ (typically a random matrix in $\{-1, 1\}^{k \times m}$) with norm $s_R := \|R\|$.  
- A "short" basis $T_B$ for $\Lambda_q^\bot(B)$ (trapdoor) and a vector $u \in \mathbb{Z}_q^n$.  
- A Gaussian parameter $\sigma > \|\tilde{T}_B\| [cite_start]\cdot s_R \cdot \omega(\sqrt{\log m})$.  

**Output:**

- Let $F_2 = (A \mid AR + B)$.  
- Outputs a short vector $e \in \mathbb{Z}^{m+k}$ sampled from a distribution statistically close to $D_{\Lambda_q^u(F_2), \sigma}$ such that $F_2 \cdot e = u \pmod q$.  

**Process:**
1. **Construct:** Build a set $T_{F_2}$ containing $(m+k)$ linearly independent vectors in $\Lambda_q^\bot(F_2)$ such that their Gram-Schmidt norm satisfies $\|\tilde{T}_{F_2}\| \le \|\tilde{T}_B\| (s_R + 1)$.  

2. **Convert:** Use Lemma 3 to transform $T_{F_2}$ into a valid basis $T'_{F_2}$ of $\Lambda_q^\bot(F_2)$ while preserving the same Gram-Schmidt norm.  

3. **Sample:** Run $e \leftarrow \text{SamplePre}(F_2, T'_{F_2}, u, \sigma)$ to generate the target vector $e$.  
**Mathematical Summary (How to construct $T_{F_2}$ in Step 1):**

- We need to build $(m+k)$ independent vectors that evaluate to $0$ when multiplied by $F_2$.  
- **The first $m$ vectors:** - For each basis vector $b_i \in T_B$, create $t_i = \begin{bmatrix} -R b_i \\ b_i \end{bmatrix}$.  
  - *Proof:* $F_2 \cdot t_i = -A R b_i + (AR + B) b_i = B b_i = 0 \pmod q$.  

- **The next $k$ vectors:**
  - Let $w_i$ be the columns of the identity matrix $I_k$.  
  - Find any $u_i$ satisfying $A w_i + B u_i = 0 \pmod q$.  
  - Create $t_{i+m} = \begin{bmatrix} w_i - R u_i \\ u_i \end{bmatrix}$.  
  - *Proof:* $F_2 \cdot t_{i+m} = A(w_i - R u_i) + (AR + B) u_i = A w_i - AR u_i + AR u_i + B u_i = A w_i + B u_i = 0 \pmod q$.  


## **The Basic IBE Construction**

### **Algorithm TrapGen**

$\text{TrapGen}(q,n)$ is used to generate a public matrix together with a short trapdoor for its orthogonal lattice.

**Inputs:**

* An odd prime modulus $q \ge 3$.
* A security parameter $n$.
* The matrix width is usually chosen as $m = \lceil 6n\log q\rceil$.

**Outputs:**

The algorithm outputs a pair $(A,S)$, where:

* $A \in \mathbb{Z}_q^{n \times m}$ is the public matrix.
* $S \in \mathbb{Z}^{m \times m}$ is a short basis of the lattice $\Lambda_q^\bot(A)$.

The orthogonal lattice is defined as:

$\Lambda_q^\bot(A)={x\in \mathbb{Z}^m : Ax = 0 \pmod q}$

The generated matrix $A$ is statistically close to uniform over $\mathbb{Z}_q^{n \times m}$. Therefore, from the public view, $A$ looks like a random matrix and does not reveal its trapdoor.

Since $S$ is a basis of $\Lambda_q^\bot(A)$, it satisfies:

$A S = 0 \pmod q$

Moreover, $S$ is short. With overwhelming probability, its Gram-Schmidt norm is bounded by:

$|\widetilde{S}| \le O(\sqrt{n\log q})$

The maximum Gram-Schmidt norm produced by $\text{TrapGen}$ is denoted by $\sigma_{TG}$.

**Process:**

1. **Start from a gadget matrix.**
   The algorithm uses a structured gadget matrix $G$ with an efficiently known short trapdoor. This matrix is easy to invert or sample from, but it cannot be used directly as a public matrix because its structure is obvious.

2. **Generate randomness.**
   It samples a random matrix $A_1$ and a small matrix $R$, where the entries of $R$ are usually chosen from a small distribution such as ${-1,0,1}$.

3. **Hide the gadget matrix.**
   The public matrix is constructed by masking the gadget matrix using $A_1R$. A simplified form is:

$$
\begin{aligned}
A_2 &= G - A_1R \pmod q, \\
A &= [A_1 \mid A_2].
\end{aligned}
$$

Then we have:

$$
\begin{aligned}
A
\begin{bmatrix}
R\\
I
\end{bmatrix}
&=
[A_1 \mid G - A_1R]
\begin{bmatrix}
R\\
I
\end{bmatrix} \\
&= A_1R + (G - A_1R) \\
&= G \pmod q.
\end{aligned}
$$

This equation shows that knowing $R$ allows us to reduce problems involving $A$ to problems involving the easy gadget matrix $G$.\

4. **Derive the trapdoor basis.**

In the abstract definition of $\text{TrapGen}$, the trapdoor is written as a short basis $S$ of $\Lambda_q^\bot(A)$. In the gadget-trapdoor view, the algorithm first obtains a compact trapdoor $R$, and then derives the full basis $S$ from $R$ and the known short basis of the gadget lattice.

Let $B_G$ be a short basis of $\Lambda_q^\bot(G)$, so:

$$
G B_G = 0 \pmod q.
$$

Since:

$$
A
\begin{bmatrix}
R\\
I
\end{bmatrix}
=
G \pmod q,
$$

we can lift every short relation of $G$ into a relation of $A$. In particular:

$$
\begin{aligned}
A
\left(
\begin{bmatrix}
R\\
I
\end{bmatrix}
B_G
\right)
&=
G B_G \\
&= 0 \pmod q.
\end{aligned}
$$

Therefore, the columns of

$$
\begin{bmatrix}
R\\
I
\end{bmatrix}
B_G
$$

are short vectors in $\Lambda_q^\bot(A)$.

However, these vectors only explain how the compact trapdoor $R$ gives short relations for $A$. To obtain the full trapdoor basis, the algorithm applies a basis-extension procedure:

$$
S = \textsf{BasisFromTrapdoor}(A,R,B_G).
$$

The resulting matrix $S$ is a full-rank short basis of $\Lambda_q^\bot(A)$ and satisfies:

$$
AS = 0 \pmod q.
$$

The important point is that $S$ is not sampled randomly. It is derived from the compact trapdoor $R$ and the short gadget basis $B_G$. Since both components have small norm, the resulting basis $S$ also has bounded Gram-Schmidt norm.

In summary, $\text{TrapGen}$ creates a public matrix $A$ that is statistically close to uniform, while secretly keeping a compact trapdoor $R$. From this trapdoor, one can derive a short basis $S$ for $\Lambda_q^\bot(A)$. This hidden structure is later used in Gaussian sampling algorithms such as $\text{SampleLeft}$, $\text{SampleRight}$, and key extraction.

### **1. Setup**

- **Input:** Security parameter $\lambda \rightarrow q, n, m, \sigma, \alpha$ .
- **Generate Left Matrix:** Run $\text{TrapGen}(q, n) \rightarrow$ uniformly random matrix $A_0 \in \mathbb{Z}_q^{n \times m}$ and its trapdoor basis $T_{A_0}$ for $\Lambda_q^\bot(A_0)$.
- **Generate Random Matrices:** $A_1, B \in \mathbb{Z}_q^{n \times m}$.
- **Generate Random Vector:** $u \in \mathbb{Z}_q^n$.
- **Output:** - $PP = (A_0, A_1, B, u)$
  - $MK = T_{A_0}$

### **2. Extract**

- **Input:** $PP, MK, id \in \mathbb{Z}_q^n$.
- **Compute:** Define the identity matrix $F_{id} = (A_0 \mid A_1 + H(id)B) \in \mathbb{Z}_q^{n \times 2m}$ (where $H$ is an FRD map).
- **Sample:** Run $e \leftarrow \text{SampleLeft}(A_0, A_1 + H(id)B, T_{A_0}, u, \sigma)$.
- **Output:** $SK_{id} = e \in \mathbb{Z}^{2m}$ (Note: $F_{id} \cdot e = u \pmod q$).

### **3. Encrypt**

- **Input:** $PP, id,$ message $b \in \{0, 1\}$.
- **Reconstruct Matrix:** $F_{id} = (A_0 \mid A_1 + H(id)B)$.
- **Ephemeral Secret:** Choose uniformly random $s \leftarrow \mathbb{Z}_q^n$.
- **Randomness Matrix:** Choose $R \leftarrow \{-1, 1\}^{m \times m}$.
- **Noise Vectors:** Sample $x \leftarrow \bar{\Psi}_\alpha$ over $\mathbb{Z}_q$ and $y \leftarrow \bar{\Psi}_\alpha^m$ over $\mathbb{Z}_q^m$. Set $z = R^T y \in \mathbb{Z}_q^m$.
- **Ciphertext:** - $c_0 = u^T s + x + b\lfloor q/2 \rfloor \pmod q$
  - $c_1 = F_{id}^T s + \begin{bmatrix} y \\ z \end{bmatrix} \pmod q$
- **Output:** $CT = (c_0, c_1)$.

### **4. Decrypt**

- **Input:** $PP, SK_{id} = e, CT = (c_0, c_1)$.
- **Compute:** $w = c_0 - e^T c_1 \pmod q$.
- **Evaluate:** Compare $w$ and $\lfloor q/2 \rfloor$ as integers.
  - If $|w - \lfloor q/2 \rfloor| < \lfloor q/4 \rfloor \rightarrow$ output $1$.
  - Otherwise $\rightarrow$ output $0$.

### **5. Correctness**

We prove that decryption recovers the bit $b \in \{0,1\}$ correctly with overwhelming probability.

From `Extract`, the private key $SK_{id}=e$ satisfies:

$$
F_{id}e = u \pmod q
$$

where:

$$
F_{id} = (A_0 \mid A_1 + H(id)B)
$$

During encryption, we have:

$$
c_0 = u^Ts + x + b\left\lfloor \frac q2 \right\rfloor \pmod q
$$

and

$$
c_1 = F_{id}^Ts +
\begin{bmatrix}
y \\
z
\end{bmatrix}
\pmod q
$$

where $z = R^Ty$.

In decryption, we compute:

$$
w = c_0 - e^Tc_1 \pmod q
$$

Substituting $c_0$ and $c_1$ gives:

$$
\begin{aligned}
w
&= u^Ts + x + b\left\lfloor \frac q2 \right\rfloor
- e^T\left(F_{id}^Ts +
\begin{bmatrix}
y \\
z
\end{bmatrix}
\right) \pmod q \\
&= u^Ts + x + b\left\lfloor \frac q2 \right\rfloor
- (F_{id}e)^Ts
- e^T
\begin{bmatrix}
y \\
z
\end{bmatrix}
\pmod q
\end{aligned}
$$

Since $F_{id}e = u \pmod q$, we have:

$$
(F_{id}e)^Ts = u^Ts \pmod q
$$

Therefore:

$$
w =
b\left\lfloor \frac q2 \right\rfloor
+
x
-
e^T
\begin{bmatrix}
y \\
z
\end{bmatrix}
\pmod q
$$

Define the error term as:

$$
\text{err}
=
x
-
e^T
\begin{bmatrix}
y \\
z
\end{bmatrix}
$$

Hence:

$$
w =
b\left\lfloor \frac q2 \right\rfloor
+
\text{err}
\pmod q
$$

So if $\text{err}$ is small, then $w$ is close to $0$ when $b=0$, and close to $\left\lfloor q/2 \right\rfloor$ when $b=1$.

---

### **Error Bound**

Write:

$$
e = (e_1 \mid e_2)
$$

where $e_1,e_2 \in \mathbb{Z}^m$.

Then:

$$
\begin{aligned}
\text{err}
&= x - e_1^Ty - e_2^Tz \\
&= x - e_1^Ty - e_2^TR^Ty \\
&= x - (e_1 + Re_2)^Ty
\end{aligned}
$$

Since $e$ is sampled from a discrete Gaussian with parameter $\sigma$, by Lemma 8:

$$
\|e\| \le \sigma \sqrt{2m}
$$

with overwhelming probability.

Also, since $R \leftarrow \{-1,1\}^{m \times m}$, by Lemma 15:

$$
\|R\| \le O(\sqrt m)
$$

with overwhelming probability.

Therefore:

$$
\|e_1 + Re_2\|
\le
\|e_1\| + \|R\|\|e_2\|
\le
O(\sigma m)
$$

By Lemma 12, for $y \leftarrow \bar{\Psi}_\alpha^m$:

$$
|(e_1 + Re_2)^Ty|
\le
q\sigma m\alpha \omega(\sqrt{\log m})
+
O(\sigma m^{3/2})
$$

Thus, the total error is bounded by:

$$
|\text{err}|
\le
q\sigma m\alpha \omega(\sqrt{\log m})
+
O(\sigma m^{3/2})
$$

with overwhelming probability.

---

### **Correct Decryption Condition**

For correct decryption, the error must be small enough so that $w$ remains closer to the correct region.

The decryption rule is:

$$
\left|w - \left\lfloor \frac q2 \right\rfloor\right|
<
\left\lfloor \frac q4 \right\rfloor
$$

If this holds, output $1$; otherwise, output $0$.

It is sufficient to require:

$$
|\text{err}| < \frac q5
$$

Therefore, we need:

$$
q\sigma m\alpha \omega(\sqrt{\log m})
+
O(\sigma m^{3/2})
<
\frac q5
$$

This is satisfied when:

$$
\alpha < \frac{1}{\sigma m\omega(\sqrt{\log m})}
$$

and

$$
q = \Omega(\sigma m^{3/2})
$$

---

### **Parameter Choice**

The paper chooses the following parameters:

$$
m = 6n^{1+\delta}
$$

$$
q = m^{2.5}\cdot \omega(\sqrt{\log n})
$$

$$
\sigma = m\cdot \omega(\sqrt{\log n})
$$

$$
\alpha =
\left[
m^2\cdot \omega(\sqrt{\log n})
\right]^{-1}
$$

where $n$ is the security parameter.

These parameters ensure that:

$$
|\text{err}| < \frac q5
$$

with overwhelming probability.

Therefore, decryption outputs the correct bit $b$ with overwhelming probability.

### **Security Games for Basic IBE**

#### **Security Model**

Basic IBE is proven secure in the INDr-sID-CPA model. This is a selective-ID model, so the adversary must announce the target identity $id^*$ before seeing the public parameters.

The challenger then gives either a real encryption of the challenge bit or a uniformly random ciphertext from the ciphertext space. The adversary's goal is to distinguish which case it received.

#### **Game 0: The Real Security Game**

Game 0 is the original INDr-sID-CPA game for Basic IBE.

The public parameters are:

$$
PP=(A_0,A_1,B,u)
$$

Here $A_0$ is generated by $\text{TrapGen}$, so the challenger knows the trapdoor $T_{A_0}$ for $\Lambda_q^\bot(A_0)$. The matrices $A_1$ and $B$ are uniform random matrices.

For a private-key query $id \neq id^*$, the challenger computes:

$$
F_{id}=(A_0 \mid A_1+H(id)B)
$$

and answers using:

$$
e \leftarrow \text{SampleLeft}(A_0,A_1+H(id)B,T_{A_0},u,\sigma)
$$

This is exactly the real key extraction algorithm.

#### **Game 1: Programming the Target Identity**

Game 1 changes only the way $A_1$ is generated. The challenger chooses a small random matrix:

$$
R^* \leftarrow \{-1,1\}^{m\times m}
$$

and sets:

$$
A_1 = A_0R^* - H(id^*)B
$$

For the target identity $id^*$, we get:

$$
\begin{aligned}
A_1+H(id^*)B
&= A_0R^* - H(id^*)B + H(id^*)B \\
&= A_0R^*.
\end{aligned}
$$

Therefore:

$$
F_{id^*}=(A_0 \mid A_0R^*)
$$

This special form is useful because it lets the simulator embed the LWE challenge into the target ciphertext.

Game 0 and Game 1 are statistically close. Intuitively, $A_0R^*$ is statistically close to a uniform matrix, so $A_1$ still looks random. In the ABB proof, the same randomness-extraction argument also handles the leakage of $(R^*)^Ty$ used in the challenge ciphertext.

#### **Game 2: Switching the Trapdoor to $B$**

Game 2 changes how the public matrices are generated. Now $A_0$ is chosen as a random matrix, while $B$ is generated using $\text{TrapGen}$. Therefore, the challenger knows the trapdoor $T_B$ instead of $T_{A_0}$.

The matrix $A_1$ is still programmed as:

$$
A_1 = A_0R^* - H(id^*)B
$$

For a private-key query $id \neq id^*$, we expand:

$$
\begin{aligned}
F_{id}
&=(A_0 \mid A_1+H(id)B) \\
&=(A_0 \mid A_0R^* - H(id^*)B + H(id)B) \\
&=(A_0 \mid A_0R^* + (H(id)-H(id^*))B).
\end{aligned}
$$

Because $H$ is an FRD map, for $id \neq id^*$, the matrix $H(id)-H(id^*)$ is full-rank. Thus $T_B$ also works as a trapdoor for $(H(id)-H(id^*))B$.

The challenger can answer the key query using:

$$
e \leftarrow \text{SampleRight}
\left(
A_0,
(H(id)-H(id^*))B,
R^*,
T_B,
u,
\sigma
\right)
$$

The output $e$ is distributed statistically close to a valid secret key for $id$.

The challenger cannot answer a key query for $id^*$, because then:

$$
H(id)-H(id^*)=0
$$

and the right-side trapdoor disappears. This is allowed because the selective-ID security game forbids the adversary from asking for the private key of the target identity.

#### **Game 3: Random Challenge Ciphertext**

Game 3 is the same as Game 2, except that the challenge ciphertext is replaced by a uniformly random element of the ciphertext space:

$$
CT^* \leftarrow \mathbb{Z}_q \times \mathbb{Z}_q^{2m}
$$

Since the challenge ciphertext is random and independent of the challenge bit, the adversary has zero advantage in this game.

#### **Reduction from LWE**

The difference between Game 2 and Game 3 is bounded by the hardness of LWE.

The simulator receives LWE samples:

$$
(u_i,v_i)
$$

It uses the vectors $u_1,\dots,u_m$ to form $A_0$:

$$
A_0=[u_1|\cdots|u_m]
$$

and uses $u_0$ as the public vector $u$.

For the challenge ciphertext, let:

$$
v^*=(v_1,\dots,v_m)^T
$$

The simulator sets:

$$
c_0^* = v_0 + b^*\left\lfloor \frac{q}{2} \right\rfloor
$$

and:

$$
c_1^* =
\begin{bmatrix}
v^*\\
(R^*)^T v^*
\end{bmatrix}
$$

If the oracle is an LWE oracle, then:

$$
v^*=A_0^Ts+y
$$

and therefore:

$$
\begin{aligned}
c_1^*
&=
\begin{bmatrix}
A_0^Ts+y\\
(R^*)^T(A_0^Ts+y)
\end{bmatrix} \\
&=
\begin{bmatrix}
A_0^Ts+y\\
(A_0R^*)^Ts+(R^*)^Ty
\end{bmatrix} \\
&=
(F_{id^*})^Ts+
\begin{bmatrix}
y\\
(R^*)^Ty
\end{bmatrix}.
\end{aligned}
$$

This is distributed as a real challenge ciphertext in Game 2. Also, $v_0=u^Ts+x$, so:

$$
c_0^*=u^Ts+x+b^*\left\lfloor \frac{q}{2} \right\rfloor
$$

which matches the real encryption form.

If the oracle is random, then $v_0$ and $v^*$ are random. By the same randomness-extraction argument used above, the pair visible in $c_1^*$ is statistically close to uniform, so the challenge ciphertext is distributed as in Game 3.

Therefore, any adversary that distinguishes Game 2 from Game 3 can be used to solve LWE.

#### **Conclusion**

Game 0 is the real Basic IBE security game. Game 1 and Game 2 are statistically close to the previous games. Game 2 and Game 3 are computationally indistinguishable under the LWE assumption. In Game 3, the challenge ciphertext is random, so the adversary has zero advantage.

Therefore, Basic IBE is INDr-sID-CPA secure.

This proof only gives selective-ID security because the simulator needs the target identity $id^*$ before Setup in order to program:

$$
A_1=A_0R^*-H(id^*)B
$$

Thus, the adversary must commit to $id^*$ before seeing the public parameters. The Full IBE construction is later introduced to handle adaptive-ID security.

## FULL IBE

### **From Selective to Adaptive-ID (The Intuition)**
To upgrade from Selective-ID to Adaptive-ID security, the scheme adopts Waters' hash methodology. Instead of a single matrix $A_1$, the public parameters now contain a sequence of random matrices $A_1, \dots, A_\ell$.

- An identity is treated as a bit sequence $id = (b_1, \dots, b_\ell) \in \{1, -1\}^\ell$.
- The identity matrix is evaluated dynamically as $F_{id} = (A_0 \mid B + \sum_{i=1}^\ell b_i A_i)$.

**The Security Trick:** During the security proof, the simulator constructs each $A_i = A_0 R_i + h_i B$ (where $h_i \in \mathbb{Z}_q$ is a secret coefficient). Expanding this gives:$$F_{id} = \left( A_0 \;\middle|\; A_0 \sum_{i=1}^\ell b_i R_i + \left(1 + \sum_{i=1}^\ell b_i h_i\right) B \right)$$
The simulator knows $T_B$ (the trapdoor for $B$).

- For most queries, $1 + \sum b_i h_i \neq 0 \pmod q$, allowing the simulator to use $T_B$ to answer key-extraction queries.
- However, for the target identity $id^*$ chosen adaptively by the attacker, the term magically cancels out: $1 + \sum b_i h_i = 0 \pmod q$. The $B$ matrix disappears from $F_{id^*}$, removing the simulator's ability to extract a key, but perfectly enabling it to embed the LWE challenge ciphertext.

**The Full-IBE Construction**
**1. Setup**

- **Input:** Security parameter $\lambda \rightarrow q, n, m, \sigma, \alpha, \ell$.
- **Generate Left Matrix:** Run $\text{TrapGen}(q, n) \rightarrow$ uniformly random matrix $A_0 \in \mathbb{Z}_q^{n \times m}$ and its trapdoor basis $T_{A_0}$ for $\Lambda_q^\bot(A_0)$.
- **Generate Random Matrices:** Select $(\ell + 1)$ uniformly random matrices $A_1, \dots, A_\ell, B \in \mathbb{Z}_q^{n \times m}$.
- **Generate Random Vector:** Select $u \leftarrow \mathbb{Z}_q^n$.
- **Output:** - $PP = (A_0, A_1, \dots, A_\ell, B, u)$
  - $MK = T_{A_0}$

**2. Extract**

- **Input:** $PP, MK, id = (b_1, \dots, b_\ell) \in \{1, -1\}^\ell$.
- **Compute Identity Matrix:** Let $A_{id} = B + \sum_{i=1}^\ell b_i A_i \in \mathbb{Z}_q^{n \times m}$.
- **Sample:** Run $e \leftarrow \text{SampleLeft}(A_0, A_{id}, T_{A_0}, u, \sigma)$.
- **Output:** $SK_{id} = e \in \mathbb{Z}^{2m}$.

*(Note: Let $F_{id} = (A_0 \mid A_{id})$. By Theorem 17, $F_{id} \cdot e = u \pmod q$).*

**3. Encrypt**

- **Input:** $PP, id = (b_1, \dots, b_\ell)$, message $b \in \{0, 1\}$.
- **Reconstruct Matrix:** Compute $A_{id} = B + \sum_{i=1}^\ell b_i A_i$ and set $F_{id} = (A_0 \mid A_{id}) \in \mathbb{Z}_q^{n \times 2m}$.
- **Ephemeral Secret:** Choose uniformly random $s \leftarrow \mathbb{Z}_q^n$.
- **Randomness Matrix:** Choose $\ell$ random matrices $R_1, \dots, R_\ell \leftarrow \{-1, 1\}^{m \times m}$ and compute their weighted sum: $R_{id} = \sum_{i=1}^\ell b_i R_i \in \{-\ell, \dots, \ell\}^{m \times m}$.

*(Optimization note: $R_{id}$ can be sampled directly from a binomial distribution).*

- **Noise Vectors:** Sample $x \leftarrow \bar{\Psi}_\alpha$ over $\mathbb{Z}_q$ and $y \leftarrow \bar{\Psi}_\alpha^m$ over $\mathbb{Z}_q^m$. Set $z = R_{id}^T y \in \mathbb{Z}_q^m$.
- **Ciphertext:** - $c_0 = u^T s + x + b\lfloor q/2 \rfloor \pmod q$
  - $c_1 = F_{id}^T s + \begin{bmatrix} y \\ z \end{bmatrix} \pmod q$
- **Output:** $CT = (c_0, c_1)$.

**4. Decrypt**

- **Input:** $PP, SK_{id} = e, CT = (c_0, c_1)$.
- **Compute:** $w = c_0 - e^T c_1 \pmod q$.
- **Evaluate:** Compare $w$ and $\lfloor q/2 \rfloor$ treating them as integers.
  - If $|w - \lfloor q/2 \rfloor| < \lfloor q/4 \rfloor \rightarrow$ output $1$.
  - Otherwise $\rightarrow$ output $0$.

### **Security Games for Full IBE**

#### **Goal of the Proof**

Full IBE is proven secure in the adaptive identity model, also called INDr-ID-CPA. Unlike Basic IBE, the adversary does not need to commit to the target identity before setup. It can choose the target identity only later, during the challenge phase.

The proof uses a sequence of games:

$$
\text{Game 0} \rightarrow \text{Game 1} \rightarrow \text{Game 2} \rightarrow \text{Game 3} \rightarrow \text{Game 4}
$$

The goal is to show that a real challenge ciphertext is indistinguishable from a random ciphertext under the LWE assumption.

#### **Game 0: The Real Adaptive-ID Game**

Game 0 is the real INDr-ID-CPA game for the Full IBE scheme.

The public parameters are:

$$
PP=(A_0,A_1,\dots,A_\ell,B,u)
$$

Here $A_0$ is generated by $\text{TrapGen}$, so the challenger knows the trapdoor $T_{A_0}$. The matrices $A_1,\dots,A_\ell,B$ are uniformly random.

For an identity:

$$
id=(b_1,\dots,b_\ell)\in\{1,-1\}^{\ell}
$$

define:

$$
A_{id}=B+\sum_{i=1}^{\ell} b_iA_i
$$

and:

$$
F_{id}=(A_0 \mid A_{id})
$$

For private-key queries, the challenger answers using the real extraction algorithm:

$$
e \leftarrow \text{SampleLeft}(A_0,A_{id},T_{A_0},u,\sigma)
$$

where $e$ satisfies:

$$
F_{id}e=u \pmod q
$$

#### **Game 1: Programming the Public Matrices**

Game 1 changes the way the matrices $A_i$ are generated. The challenger chooses small matrices:

$$
R_i^* \leftarrow \{-1,1\}^{m\times m}
$$

and random scalars:

$$
h_i \leftarrow \mathbb{Z}_q
$$

for $i=1,\dots,\ell$. Using the sign convention of this report, the challenger defines:

$$
A_i=A_0R_i^*+h_iB
$$

This is equivalent to the ABB convention $A_i=A_0R_i^*-h_iB$ after replacing each uniform $h_i$ by $-h_i$. The important point is that this programming does not require knowing the target identity in advance.

For any identity $id=(b_1,\dots,b_\ell)$, define:

$$
\begin{aligned}
R_{id} &= \sum_{i=1}^{\ell} b_iR_i^*,\\
h_{id} &= 1+\sum_{i=1}^{\ell} b_ih_i.
\end{aligned}
$$

Then:

$$
\begin{aligned}
A_{id}
&=B+\sum_{i=1}^{\ell}b_iA_i\\
&=B+\sum_{i=1}^{\ell}b_i(A_0R_i^*+h_iB)\\
&=A_0R_{id}+h_{id}B.
\end{aligned}
$$

Therefore:

$$
F_{id}=(A_0 \mid A_0R_{id}+h_{id}B)
$$

Game 0 and Game 1 are statistically close because the matrices $A_0R_i^*$ look statistically close to uniform. The challenge ciphertext leakage involving $(R_{id})^Ty$ is also handled by the same randomness-extraction argument.

#### **Game 2: Adding the Waters Abort Condition**

Game 2 adds a hidden abort condition using a Waters-style hash value:

$$
H(id)=h_{id}=1+\sum_{i=1}^{\ell}b_ih_i
$$

The simulator wants:

$$
H(id^*)=0
$$

for the challenge identity, and:

$$
H(id_i)\neq 0
$$

for every private-key query identity $id_i$.

If this condition fails, the challenger aborts by replacing the adversary's final guess with a fresh random bit. The adversary does not see the hash function and does not know whether an abort happened.

The artificial abort is used to make the non-abort probability almost independent of the adversary's chosen identities. This is the main technical idea from Waters' proof technique.

With this step, the proof loses only a controlled factor in the adversary's advantage:

$$
\begin{aligned}
\left|\Pr[W_2]-\frac{1}{2}\right|
&\ge
\frac{1}{4q}
\left|\Pr[W_1]-\frac{1}{2}\right|.
\end{aligned}
$$

#### **Game 3: Switching the Trapdoor to $B$**

Game 3 changes how $A_0$ and $B$ are generated. Now $A_0$ is chosen as a random matrix, while $B$ is generated using $\text{TrapGen}$. Therefore, the challenger knows the trapdoor $T_B$ instead of $T_{A_0}$.

The matrices $A_i$ are still generated as:

$$
A_i=A_0R_i^*+h_iB
$$

For a private-key query on identity $id$, compute:

$$
\begin{aligned}
R_{id} &= \sum_{i=1}^{\ell} b_iR_i^*,\\
h_{id} &= 1+\sum_{i=1}^{\ell} b_ih_i.
\end{aligned}
$$

Then:

$$
F_{id}=(A_0 \mid A_0R_{id}+h_{id}B)
$$

If $h_{id}=0$, the challenger aborts. If $h_{id}\neq 0$, then $T_B$ can also be used as a trapdoor for $h_{id}B$, since $h_{id}$ is nonzero in $\mathbb{Z}_q$.

The challenger answers the key query using:

$$
e \leftarrow \text{SampleRight}(A_0,h_{id}B,R_{id},T_B,u,\sigma)
$$

The output $e$ is statistically close to a valid secret key for $id$.

For the target identity $id^*$, the non-abort condition requires:

$$
h_{id^*}=0
$$

So:

$$
F_{id^*}=(A_0 \mid A_0R_{id^*})
$$

This form is exactly what is needed to embed the LWE challenge ciphertext. Game 2 and Game 3 are identical from the adversary's view, because the public parameters and private-key answers have the same distributions up to negligible statistical distance.

#### **Game 4: Random Challenge Ciphertext**

Game 4 is the same as Game 3, except that the challenge ciphertext is replaced by a uniformly random element of the ciphertext space:

$$
CT^* \leftarrow \mathbb{Z}_q \times \mathbb{Z}_q^{2m}
$$

Since the challenge ciphertext is random and independent of the challenge bit, the adversary has zero advantage in this game.

#### **Reduction from LWE**

The difference between Game 3 and Game 4 is bounded by the hardness of LWE.

The simulator receives LWE samples:

$$
(u_i,v_i)
$$

It uses $u_1,\dots,u_m$ to construct:

$$
A_0=[u_1|\cdots|u_m]
$$

and uses $u_0$ as the public vector $u$.

For the challenge ciphertext, let:

$$
v^*=(v_1,\dots,v_m)^T
$$

For the target identity $id^*=(b_1^*,\dots,b_\ell^*)$, define:

$$
R_{id^*}^*=\sum_{i=1}^{\ell}b_i^*R_i^*
$$

The simulator sets:

$$
c_0^*=v_0+b^*\left\lfloor\frac{q}{2}\right\rfloor
$$

and:

$$
c_1^*=
\begin{bmatrix}
v^*\\
(R_{id^*}^*)^Tv^*
\end{bmatrix}
$$

If the oracle is an LWE oracle, then:

$$
v^*=A_0^Ts+y
$$

Because the non-abort condition gives $h_{id^*}=0$, we have:

$$
F_{id^*}=(A_0 \mid A_0R_{id^*}^*)
$$

Therefore:

$$
\begin{aligned}
c_1^*
&=
\begin{bmatrix}
A_0^Ts+y\\
(R_{id^*}^*)^T(A_0^Ts+y)
\end{bmatrix}\\
&=
\begin{bmatrix}
A_0^Ts+y\\
(A_0R_{id^*}^*)^Ts+(R_{id^*}^*)^Ty
\end{bmatrix}\\
&=
F_{id^*}^Ts+
\begin{bmatrix}
y\\
(R_{id^*}^*)^Ty
\end{bmatrix}.
\end{aligned}
$$

This is exactly the $c_1$ part of a real challenge ciphertext in Game 3. Also, since $v_0=u^Ts+x$, we have:

$$
c_0^*=u^Ts+x+b^*\left\lfloor\frac{q}{2}\right\rfloor
$$

which matches the real encryption form.

If the oracle is random, then $v_0$ and $v^*$ are uniform random. By the leftover hash lemma, the whole challenge ciphertext is statistically close to uniform, as in Game 4.

Therefore, any adversary that distinguishes Game 3 from Game 4 can be used to solve LWE.

#### **Conclusion**

- Game 0 is the real adaptive-ID security game.
- Game 1 is statistically close to Game 0.
- Game 2 adds a hidden Waters abort condition and loses only a controlled factor.
- Game 3 switches the trapdoor from $A_0$ to $B$ without changing the adversary's view.
- Game 4 replaces the challenge ciphertext with a random ciphertext.
- Game 3 and Game 4 are computationally indistinguishable under the LWE assumption.
- In Game 4, the adversary has zero advantage.

Thus:

$$
\begin{aligned}
\left|\Pr[W_0]-\frac{1}{2}\right|
&\le
4q\cdot \text{LWE-adv}[\mathcal{B}].
\end{aligned}
$$

Full IBE achieves adaptive-ID security because the simulator does not need to know the target identity during setup. Instead, it programs all matrices $A_i$ using random coefficients $h_i$, and later the Waters hash condition selects identities with $H(id)=0$. This replaces the Basic IBE trick, where the simulator had to hard-code $id^*$ directly into $A_1$ before setup.


## **Hierarchical IBE Construction**

### **From IBE to HIBE: The Intuition**

In HIBE, an identity is no longer a single value. Instead, it is a vector:

$$
id = (id_1,\dots,id_\ell)
$$

where each component satisfies:

$$
id_i \in \mathbb{Z}_q^n \setminus \{0\}
$$

The value $\ell$ is the depth of the identity, and the system supports identities up to maximum depth $d$.

For an identity at depth $\ell$, define the matrix:

$$
F_{id}
=
\left(
A_0
\mid
A_1 + H(id_1)B
\mid
\cdots
\mid
A_\ell + H(id_\ell)B
\right)
\in \mathbb{Z}_q^{n \times (\ell+1)m}
$$

The main difference from Basic IBE is the private key format.

- In Basic IBE, the secret key is a short vector $e$ such that:

$$
F_{id}e = u \pmod q
$$

- In HIBE, the secret key is a short basis for the lattice:

$$
\Lambda_q^\bot(F_{id})
$$

This basis allows the user to delegate keys to children identities.

---

### **1. Setup**

- **Input:** Security parameter $\lambda$ and maximum hierarchy depth $d$.
- **Parameters:** Set $q,n,m,\bar{\sigma},\bar{\alpha}$, where:

$$
\bar{\sigma} = (\sigma_1,\dots,\sigma_d)
$$

and

$$
\bar{\alpha} = (\alpha_1,\dots,\alpha_d)
$$

- **Generate Root Matrix:** Run:

$$
\text{TrapGen}(q,n)
$$

to obtain a uniformly random matrix:

$$
A_0 \in \mathbb{Z}_q^{n \times m}
$$

and a short trapdoor basis:

$$
T_{A_0}
\text{ for }
\Lambda_q^\bot(A_0)
$$

- **Generate Random Matrices:** Select:

$$
A_1,\dots,A_d,B \leftarrow \mathbb{Z}_q^{n \times m}
$$

uniformly at random.

- **Generate Random Vector:** Select:

$$
u \leftarrow \mathbb{Z}_q^n
$$

- **Output:**

$$
PP = (A_0,A_1,\dots,A_d,B,u)
$$

and

$$
MK = T_{A_0}
$$

---

### **2. Derive**

The `Derive` algorithm allows a parent identity to generate the secret key for its child.

Let the parent identity be:

$$
id = (id_1,\dots,id_{\ell-1})
$$

and the child identity be:

$$
id' = (id_1,\dots,id_{\ell-1},id_\ell)
$$

Assume the parent already has a secret key:

$$
SK_{id}
$$

where $SK_{id}$ is a short basis for:

$$
\Lambda_q^\bot(F_{id})
$$

The child matrix is:

$$
F_{id'}
=
\left(
F_{id}
\mid
A_\ell + H(id_\ell)B
\right)
$$

To derive the child key, run:

$$
SK_{id'}
\leftarrow
\text{SampleBasisLeft}
\left(
F_{id},
A_\ell + H(id_\ell)B,
SK_{id},
\sigma_\ell
\right)
$$

- **Output:** $SK_{id'}$, a short basis for:

$$
\Lambda_q^\bot(F_{id'})
$$

---

### **3. Extract**

The `Extract` algorithm is just a special case of `Derive` from the root.

For the empty identity $\varepsilon$, define:

$$
F_{\varepsilon} = A_0
$$

and:

$$
SK_{\varepsilon} = T_{A_0}
$$

To extract a key for:

$$
id = (id_1,\dots,id_\ell)
$$

the PKG repeatedly applies `Derive`:

$$
SK_{(id_1)}
\leftarrow
\text{Derive}(PP,(id_1),SK_{\varepsilon})
$$

$$
SK_{(id_1,id_2)}
\leftarrow
\text{Derive}(PP,(id_1,id_2),SK_{(id_1)})
$$

and so on, until obtaining:

$$
SK_{id}
$$

where $SK_{id}$ is a short basis for:

$$
\Lambda_q^\bot(F_{id})
$$

---

### **4. Encrypt**

- **Input:** Public parameters $PP$, identity:

$$
id = (id_1,\dots,id_\ell)
$$

and message bit:

$$
b \in \{0,1\}
$$

- **Build Identity Matrix:**

$$
F_{id}
=
\left(
A_0
\mid
A_1 + H(id_1)B
\mid
\cdots
\mid
A_\ell + H(id_\ell)B
\right)
$$

- **Ephemeral Secret:** Choose:

$$
s \leftarrow \mathbb{Z}_q^n
$$

uniformly at random.

- **Randomness Matrix:** Choose:

$$
R \leftarrow \{-1,1\}^{m \times \ell m}
$$

- **Noise Vectors:** Sample:

$$
x \leftarrow \bar{\Psi}_{\alpha_\ell}
$$

and

$$
y \leftarrow \bar{\Psi}_{\alpha_\ell}^m
$$

Then compute:

$$
z = R^T y \in \mathbb{Z}_q^{\ell m}
$$

Define:

$$
\eta =
\begin{bmatrix}
y \\
z
\end{bmatrix}
\in \mathbb{Z}_q^{(\ell+1)m}
$$

- **Ciphertext:**

$$
c_0
=
u^Ts + x + b\left\lfloor \frac q2 \right\rfloor
\pmod q
$$

$$
c_1
=
F_{id}^Ts + \eta
\pmod q
$$

- **Output:**

$$
CT = (c_0,c_1)
\in
\mathbb{Z}_q \times \mathbb{Z}_q^{(\ell+1)m}
$$

---

### **5. Decrypt**

- **Input:** Public parameters $PP$, secret key $SK_{id}$, and ciphertext:

$$
CT = (c_0,c_1)
$$

Recall that $SK_{id}$ is a short basis for:

$$
\Lambda_q^\bot(F_{id})
$$

First, set:

$$
\tau_\ell
=
\sigma_\ell
\sqrt{m(\ell+1)}
\cdot
\omega(\sqrt{\log(\ell m)})
$$

Then sample a short vector:

$$
e_{id}
\leftarrow
\text{SamplePre}(F_{id},SK_{id},u,\tau_\ell)
$$

This gives:

$$
F_{id}e_{id} = u \pmod q
$$

Now compute:

$$
w = c_0 - e_{id}^Tc_1 \pmod q
$$

Finally, compare $w$ with $\left\lfloor q/2 \right\rfloor$ as integers:

- If

$$
\left|
w - \left\lfloor \frac q2 \right\rfloor
\right|
<
\left\lfloor \frac q4 \right\rfloor
$$

then output:

$$
1
$$

- Otherwise, output:

$$
0
$$

---

### **Key Difference from Basic IBE**

In Basic IBE, the private key is directly a short vector:

$$
e
\quad\text{such that}\quad
F_{id}e = u \pmod q
$$

In HIBE, the private key is a short basis:

$$
SK_{id}
\quad\text{for}\quad
\Lambda_q^\bot(F_{id})
$$

This basis can be used for two purposes:

1. To decrypt, by sampling a short preimage:

$$
e_{id}
\leftarrow
\text{SamplePre}(F_{id},SK_{id},u,\tau_\ell)
$$

2. To delegate child keys using:

$$
\text{SampleBasisLeft}
$$

Therefore, HIBE supports hierarchical key delegation while keeping the same LWE-based encryption structure.


### **Security Games for HIBE**

#### **Goal of the Proof**

The HIBE construction is proven secure in the selective identity model, also called INDr-sID-CPA.

In this game, the adversary must declare the target identity before setup:

$$
id^* = (id_1^*, \dots, id_k^*)
$$

where $k \le d$.

The proof uses a sequence of games:

$$
\text{Game 0} \rightarrow \text{Game 1} \rightarrow \text{Game 2} \rightarrow \text{Game 3}
$$

The goal is to show that a valid challenge ciphertext is indistinguishable from a random ciphertext under the LWE assumption.

---

#### **Game 0: The Real HIBE Game**

Game 0 is the real INDr-sID-CPA game for the HIBE scheme.

The challenger generates:

$$
PP = (A_0,A_1,\dots,A_d,B,u)
$$

where $A_0$ is generated by $\text{TrapGen}$, so the challenger knows:

$$
T_{A_0}
\text{ for }
\Lambda_q^\bot(A_0)
$$

For an identity:

$$
id = (id_1,\dots,id_\ell)
$$

define:

$$
F_{id}
=
\left(
A_0
\mid
A_1 + H(id_1)B
\mid
\cdots
\mid
A_\ell + H(id_\ell)B
\right)
$$

Private-key queries are answered using the real extraction and delegation algorithms. The output is a short basis:

$$
SK_{id}
\text{ for }
\Lambda_q^\bot(F_{id})
$$

The adversary is not allowed to query any identity that is a prefix of the target identity $id^*$.

---

#### **Game 1: Programming the Public Matrices**

Game 1 changes the way the matrices $A_1,\dots,A_d$ are generated.

Let the target identity be:

$$
id^*=(id_1^*,\dots,id_k^*)
$$

If $k<d$, pad it with zeros until depth $d$:

$$
id^*=(id_1^*,\dots,id_k^*,0,\dots,0)
$$

The challenger chooses random matrices:

$$
R_1^*,\dots,R_d^* \leftarrow \{-1,1\}^{m\times m}
$$

and defines:

$$
A_i = A_0R_i^* - H(id_i^*)B
$$

for every $i=1,\dots,d$.

For an identity $id=(id_1,\dots,id_\ell)$, we get:

$$
\begin{aligned}
F_{id}
&=
\left(
A_0
\mid
A_1 + H(id_1)B
\mid
\cdots
\mid
A_\ell + H(id_\ell)B
\right)\\
&=
\left(
A_0
\mid
A_0R_1^* + (H(id_1)-H(id_1^*))B
\mid
\cdots
\mid
A_0R_\ell^* + (H(id_\ell)-H(id_\ell^*))B
\right)
\end{aligned}
$$

Define:

$$
\overline{R}_\ell^*
=
(R_1^* \mid \cdots \mid R_\ell^*)
\in \mathbb{Z}_q^{m\times \ell m}
$$

and:

$$
B_{id}
=
\left(
(H(id_1)-H(id_1^*))B
\mid
\cdots
\mid
(H(id_\ell)-H(id_\ell^*))B
\right)
$$

Then:

$$
F_{id}
=
\left(
A_0
\mid
A_0\overline{R}_\ell^* + B_{id}
\right)
$$

In the challenge phase, for the target identity at depth $k$, we have:

$$
F_{id^*}
=
\left(
A_0
\mid
A_0\overline{R}_k^*
\right)
$$

because:

$$
H(id_i^*) - H(id_i^*) = 0
$$

Game 0 and Game 1 are statistically indistinguishable by the leftover hash lemma. The matrices $A_0R_i^*$ look statistically close to uniform, so the public matrices $A_i$ still look random to the adversary.

---

#### **Game 2: Switching the Trapdoor to $B$**

Game 2 changes how $A_0$ and $B$ are generated.

- $A_0$ is chosen uniformly at random.
- $B$ is generated using $\text{TrapGen}$.

So the challenger now knows:

$$
T_B
\text{ for }
\Lambda_q^\bot(B)
$$

instead of knowing a trapdoor for $A_0$.

The matrices $A_i$ are still programmed as:

$$
A_i = A_0R_i^* - H(id_i^*)B
$$

Now consider a private-key query for:

$$
id=(id_1,\dots,id_\ell)
$$

where $id$ is not a prefix of $id^*$.

The challenger must output a short basis for:

$$
\Lambda_q^\bot(F_{id})
$$

where:

$$
F_{id}
=
\left(
A_0
\mid
A_0\overline{R}_\ell^* + B_{id}
\right)
$$

Because $id$ is not a prefix of $id^*$, there exists some index $j$ such that:

$$
id_j \neq id_j^*
$$

Since $H$ is an FRD encoding, we know:

$$
H(id_j)-H(id_j^*)
$$

is full rank.

Therefore, $B_{id}$ has rank $n$ whenever $B$ has rank $n$. This allows the simulator to use the trapdoor $T_B$ to build a short basis for $\Lambda_q^\bot(B_{id})$, and then apply `SampleBasisRight`.

The challenger answers the query by running:

$$
SK_{id}
\leftarrow
\text{SampleBasisRight}
(
A_0,
B_{id},
\overline{R}_\ell^*,
T_B,
\sigma_\ell
)
$$

The output is a short basis for:

$$
\Lambda_q^\bot(F_{id})
$$

and its distribution is statistically close to the real key distribution from Game 1.

Thus, Game 1 and Game 2 are statistically indistinguishable.

---

#### **Game 3: Random Challenge Ciphertext**

Game 3 is identical to Game 2, except the challenge ciphertext is replaced by a uniformly random element:

$$
CT^*
\leftarrow
\mathbb{Z}_q \times \mathbb{Z}_q^{m+km}
$$

Since the ciphertext is completely random and independent of the challenge bit, the adversary has zero advantage in Game 3.

It remains to show that Game 2 and Game 3 are computationally indistinguishable. This is done by a reduction from LWE.

---

#### **Reduction from LWE**

Assume there exists an adversary that distinguishes Game 2 from Game 3 with non-negligible advantage. We build an algorithm $\mathcal{B}$ that solves LWE.

The LWE oracle gives samples:

$$
(u_i,v_i)\in \mathbb{Z}_q^n \times \mathbb{Z}_q
$$

for $i=0,\dots,m$.

The oracle is either:

- a real LWE oracle:

$$
v_i = u_i^Ts + x_i
$$

for some secret $s\in \mathbb{Z}_q^n$ and noise $x_i$,

- or a uniform random oracle.

---

#### **Setup of the Reduction**

The simulator constructs:

$$
A_0 = [u_1 \mid \cdots \mid u_m]
$$

and uses $u_0$ as the public vector:

$$
u = u_0
$$

It then constructs $B,A_1,\dots,A_d$ as in Game 2:

$$
A_i = A_0R_i^* - H(id_i^*)B
$$

The public parameters are:

$$
PP=(A_0,A_1,\dots,A_d,B,u)
$$

Private-key queries are answered exactly as in Game 2 using `SampleBasisRight`.

---

#### **Challenge Ciphertext**

Let:

$$
v^* =
\begin{bmatrix}
v_1\\
\vdots\\
v_m
\end{bmatrix}
\in \mathbb{Z}_q^m
$$

For the target identity:

$$
id^*=(id_1^*,\dots,id_k^*)
$$

define:

$$
\overline{R}_k^*
=
(R_1^* \mid \cdots \mid R_k^*)
$$

The simulator sets:

$$
c_0^*
=
v_0
+
b^*\left\lfloor \frac q2 \right\rfloor
$$

and:

$$
c_1^*
=
\begin{bmatrix}
v^*\\
(\overline{R}_k^*)^T v^*
\end{bmatrix}
$$

Then:

$$
CT^*=(c_0^*,c_1^*)
$$

---

#### **When the Oracle is LWE**

If the oracle is an LWE oracle, then:

$$
v^* = A_0^Ts + y
$$

where:

$$
y \leftarrow \bar{\Psi}_{\alpha_k}^m
$$

Also:

$$
v_0 = u^Ts + x
$$

For the target identity, the programmed matrix satisfies:

$$
F_{id^*}
=
\left(
A_0
\mid
A_0\overline{R}_k^*
\right)
$$

Therefore:

$$
\begin{aligned}
c_1^*
&=
\begin{bmatrix}
v^*\\
(\overline{R}_k^*)^Tv^*
\end{bmatrix}\\
&=
\begin{bmatrix}
A_0^Ts+y\\
(\overline{R}_k^*)^T(A_0^Ts+y)
\end{bmatrix}\\
&=
\begin{bmatrix}
A_0^Ts+y\\
(A_0\overline{R}_k^*)^Ts+(\overline{R}_k^*)^Ty
\end{bmatrix}\\
&=
F_{id^*}^Ts
+
\begin{bmatrix}
y\\
(\overline{R}_k^*)^Ty
\end{bmatrix}
\end{aligned}
$$

This is exactly the $c_1$ part of a valid HIBE ciphertext.

Also:

$$
c_0^*
=
u^Ts+x+b^*\left\lfloor\frac q2\right\rfloor
$$

which is exactly the $c_0$ part of a valid encryption.

So when the oracle is LWE, the adversary sees Game 2.

---

#### **When the Oracle is Random**

If the oracle is random, then:

$$
v_0 \leftarrow \mathbb{Z}_q
$$

and:

$$
v^* \leftarrow \mathbb{Z}_q^m
$$

are uniformly random.

By the leftover hash lemma, the vector:

$$
\begin{bmatrix}
v^*\\
(\overline{R}_k^*)^Tv^*
\end{bmatrix}
$$

is statistically close to uniform in:

$$
\mathbb{Z}_q^{m+km}
$$

Therefore, the challenge ciphertext is a uniformly random element of:

$$
\mathbb{Z}_q \times \mathbb{Z}_q^{m+km}
$$

So when the oracle is random, the adversary sees Game 3.

---

#### **Conclusion**

If an adversary can distinguish Game 2 from Game 3, then the simulator can distinguish LWE samples from random samples.

Thus:

$$
\text{Game 2} \approx_c \text{Game 3}
$$

under the LWE assumption.

Combining all games:

$$
\text{Game 0} \approx_s \text{Game 1}
$$

$$
\text{Game 1} \approx_s \text{Game 2}
$$

$$
\text{Game 2} \approx_c \text{Game 3}
$$

In Game 3, the challenge ciphertext is random, so the adversary has zero advantage.

Therefore, the HIBE construction is INDr-sID-CPA secure under the LWE assumption.
