# Homomorphic Encryption (HE) & BFV — A Practical, Visual Guide (with TenSEAL/SEALAPI)

> Nhan_laptop|
> ---
> ------

## Overview

- Homomorphic Encryption (HE): mã hóa sao cho tính toán trực tiếp trên ciphertext vẫn đúng như tính trên plaintext sau khi giải mã.
- BFV (Fan-Vercauteren): một sơ đồ HE cho số nguyên. Plaintext và ciphertext là đa thức trong hai vành khác nhau (mod $t$ và mod $q$).
- Batching (SIMD): đóng gói $N$ giá trị vào 1 ciphertext để tính song song (cần điều kiện $t \equiv 1 \mod 2N$).
- TenSEAL/SEALAPI: binding Python của Microsoft SEAL (thư viện HE phổ biến). Bạn sẽ tạo `EncryptionParameters`, `SEALContext`, sinh khóa, rồi `encode → encrypt → (compute) → decrypt → decode`.

## Homomorphic Encryption (HE)

### Group homomorphism

Trong toán học, cho 2 nhóm: $(G,*)$ và $(H,\bullet)$, một group homomorphism từ 2 nhóm là một function $h: G\rightarrow H$ mà với mọi phần tử $u$ và $v$ thuộc nhóm $G$ thì ta có:

$$
h(u*v)=h(u)\bullet h(v)
$$

Nơi mà phép toán ở 2 bên bằng nhau.
Từ tính chất trên thì ta có thể suy ra identity element $e_G$ của $G$ sang identity element $e_H$ của $H$:

$$
h(e_G)=e_H
$$

Và chúng ta vẫn có ánh xạ inverse:

$$
h(u^{-1})= h(u)^{-1}.
$$

#### Properties

Đặt $e_H$ là identity element của nhóm $(H,\bullet)$, và $u\in G$, ta có:

$$
h(u)\bullet e_H=h(u)=h(u*e_G)=h(u)\bullet h(e_G)
$$

Tương tự,

$$
e_H=h(e_G)=h(u*u^{-1})=h(u)\bullet h(u^{-1})
$$

Vì vậy chỉ có một ánh xạ inverse duy nhất:

$$
h(u^{-1})=h(u)^{-1}
$$

### 1) Homomorphic Encryption

#### 1.1 Intuition

Ta có:

$$
\begin{array}{c}
\left\{
\begin{aligned}
m_1 ,\ m_2\ &\rightarrow Enc(m_1),Enc(m_2)\\
+&: Dec(Enc(m_1)\oplus Enc(m_2)) = m_1 + m_2\\
\times&: Dec(Enc(m_1)\odot Enc(m_2))= m_1\cdot m_2
\end{aligned}
\right.
\end{array}
$$

Điều này cho ta có thể điều chỉnh gián tiếp plaintext tùy ý mà không cần giải mã.

#### 1.2 Levels

- **Additively homomorphic** (Pailier): chỉ cộng đồng hình.
- **Multiplicatively homomorphic** (RSA "thô"): chỉ nhân đồng hình.
- **Leveled/Somewhat HE**: cộng và nhân nhưng độ sâu tính toán có hạn vì noise tăng dần.
- **FHE**: tính toán tùy ý (dùng bootstrapping để "giảm noise"). Trong thực tế, nhiều ứng dụng dùng leveled HE (không bootstrapping) với kế hoạch tính đã biết trước.

> Noise: thành phần nhiễu trộn trong ciphertext vì an toàn. Cộng/nhân làm tăng noise; khi vượt ngưỡng, giải mã sai -> phải chọn tham số đủ lớn ($q$) hoặc giảm độ sâu.

### 2) BFV Scheme (cho số nguyên)

#### 2.1 Hai vành đa thức

- Vành ciphertext: $\mathbb{R}_q=\mathbb{Z}_q[X]/(X^N+1)$.
- Vành plaintext: $\mathbb{R}_t=\mathbb{Z}_t[X]/(X^N+1)$.

Tham số:

- $N$: bậc mô-đun (thường là lũy thừa của 2: 2048, 4096, ...).
- $t$: plain modulus (nhỏ, ví dụ cỡ $2^{18}$) - nơi dữ liệu "sống".
- $q$: coefficient modulus (rất lớn, là tích nhiều prime) - nơi ciphertext "sống".

#### 2.2 Mã hóa/giải mã (ý tưởng)

- **Sinh khóa:** $s\in \mathbb{R}_q$ (nhỏ), $a\xleftarrow{R}\mathbb{R}_q$, $e$ là noise: $pk=(b,a),\ b=-a\cdot s + e \mod{q}$.
- **Mã hóa plaintext** $m \in \mathbb{R}_t$:
  - Lấy $u,e_1,e_2$ là noise, đặt: $\Delta = \left\lfloor \frac{q}{t} \right\rfloor$.
  - $c_0=b\cdot u + e_1 + \Delta \cdot m,\ c_1 = a \cdot u + e_2 \mod q$.
- **Giải mã**: $v = c_0 + c_1\cdot s =\Delta \cdot m + \text{noise} \mod q \rightarrow$ ánh xạ về mod $t$ (khi noise nhỏ).

#### 2.3 Cộng/nhân đồng hình

- **Cộng**: cộng từng thành phần ciphertext -> noise tăng ít.
- **Nhân**: nhân hai ciphertext cho ra 3 thành phần -> cần relinearization (RelinKeys) để quay về 2 thành phần, noise tăng nhiều hơn.
- **Nhân với plaintext**: rẻ hơn, không làm nở bậc.

> Noise budget (SEAL): "vốn" nhiễu còn lại. Mỗi phép toán làm hao mòn budget. Hết budget -> mất tính nguyên vẹn.

### 3) Batching (SIMD - Single Instruction, Multiple Data)

Quá trình mã hóa và giải mã gắn liền với:

- Các vector slots: một mảng $N$ số nguyên modulo $t$.

$$
v = (v[0],v[1],\cdots, v[N-1])\in \mathbb{Z}^N_t
$$

- Đa thức (polynomial): một đa thức bậc $< N$ trong vành:

$$
\begin{array}{c}
\left\{
\begin{aligned}
R_t&=\mathbb{Z}_t[X]/(X^N+1)\\
\text{Poly: }m(X)&= a_0 + a_1\cdot X + \cdots + a_{N-1}\cdot X^{N-1}\ (\ a_i\mod t\ )
\end{aligned}
\right.
\end{array}
$$

The rings $\mathbb{Z}$ và $R_t$ là 2 loại hoàn toàn khác nhau (rõ ràng nhất là một cái là tập các số vô hạn, trong khi đó $R_t$ là hữu hạn), chúng thật sự không isomorphic. Tuy nhiên chúng ta có thể đóng gói $n$ số nguyên mô-đun $t$ vào trong 1 plaintext polynomial và để vận hành các số nguyên đó trong SIMD manner. Kĩ thuật này thường được gọi là batching trong homomorphic encryption literature.

> Để chi tiết hơn về các tính chất lí thuyết và áp dụng, các bạn có thể tham khảo ở:
> [.]: Nigel P Smart and Frederik Vercauteren. Fully homomorphic SIMD operations. Designs, Codes and Cryptography, 71(1):57–81, 2014.
> [.]: Zvika Brakerski, Craig Gentry, and Shai Halevi. Packed ciphertexts in LWE-based homomorphic encryption. In Public-Key Cryptography–PKC 2013, pages 1–13. Springer, 2013.

Ở batching ta làm việc với 2 khái niệm là Encode và Decode.
Encode là ánh xạ biến vector slot $V$ thành đa thức $m(X)$. Decode làm ngược lại.

Quan trọng ở HE: sau khi mã hóa (encrypt), ta có thể cộng/nhân ciphertext sao cho khi decrypt và decode, kết quả đúng với ta thực hiện chúng trên slot của $v$.

#### Batching

Để encode/decode được ta cần:

- $N$ là lũy thừa của 2 (ví dụ 4096).
- Plaintext modulus $t$ thỏa $t\equiv 1 \mod 2N$.

Điều kiện này đảm bảo tồn tại một phần tử $\zeta \in \mathbb{Z}_t$ có bậc $2N$ (mod $t$). Với mỗi $\zeta$ được gọi là căn bậc $2N$ nguyên thủy của đơn vị modulo $t$. Có một căn bậc $2N$ nguyên thủy của đơn vị trong $\mathbb{Z}_t$ là quan trọng vì khi polynomial modulus $x^n+1$ phân tích modulo $t$ như:

$$
x^n+1=(x-\zeta)\cdot (x-\zeta^3)\cdots (x-\zeta^{2n-1})\mod t
$$

Và theo Chinese Remainder Theorem (CRT), ring $R_t$ phân rã thành:

$$
R_t = \frac{\mathbb{Z}_t[x]}{(x^n + 1)}
= \frac{\mathbb{Z}_t[x]}{\prod_{i=0}^{n-1}(x - \zeta^{2i+1})}
\overset{\text{CRT}}{\cong}
\prod_{i=0}^{n-1} \frac{\mathbb{Z}_t[x]}{(x - \zeta^{2i+1})}
\cong
\prod_{i=0}^{n-1} \mathbb{Z}_t[\zeta^{2i+1}]
\cong
\prod_{i=0}^{n-1} \mathbb{Z}_t.
$$

Tất cả các đồng cấu trên đều là đồng cấu của vòng, tức là chúng đều thỏa nhân và cộng ở cả 2 vế, cho phép thực hiện $n$ phép cộng theo hệ số (tương ứng với phép nhân) trong số nguyên modulo $t$ (bên phải) cùng với một giá trị đơn cộng (nhân) trong $R_t$ (ở bên trái). Để đơn giản hơn, biểu thị $\alpha_i = \zeta^{2i+1}$. Theo một hướng đồng cấu được cho ở dạng:

$$
\text{Decompose:}\ R_t \overset{\cong}{\longrightarrow}
\prod_{i=0}^{n-1} \mathbb{Z}_t,
\quad
m(x) \longmapsto [\,m(\alpha_0),\, m(\alpha_1),\, \ldots,\, m(\alpha_{n-1})\,].
$$

> Note: https://www.microsoft.com/en-us/research/wp-content/uploads/2017/06/sealmanual_v2.2.pdf trong bài viết này họ không nói chi tiết cách Compose như nào: "The inverse is slightly trickier to describe, so we omit it here for the sake of simplicity. We define Compose to be the inverse of Decompose". Nhưng mình sẽ nói qua một tí về phần này.

**Compose - Encode**

Những đồng cấu này được tính toán bằng cách sử dụng negacyclic variant of the Number Theoretic Transform (NTT) (cứ suy nghĩ đơn giản là tích của 2 đa thức trong $\mathbb{Z}_t/[X^N+1]$).

**Encode:**
Ta thay đổi ký hiệu 1 chút (để tránh trùng lặp), ta thay $\psi:=\zeta$: gọi $\zeta_j= \psi^{2j+1}$ (nghiệm của $X^N+1$), $\omega=\psi^2$ (gốc $N$-th). Encode là INTT negacyclic:

1. **Hoán vị**: $v'=\pi(v)$ (hoán vị để NTT chạy nhanh hơn).
2. **INTT negacyclic**:

$$
a_k = \frac{1}{N} \sum_{j=0}^{N-1} v'[j] \cdot \zeta_j^{-k} \pmod{t},
\qquad k = 0, \ldots, N-1.
$$

3. Trả về `Plaintext` chứa các $(a_0,\cdots,a_{N-1})$.

Encode là tuyến tính: $encode(\lambda u+\mu w) = \lambda encode(u)+\mu encode(w)$.

### 4) Kiến trúc & API trong Microsoft SEAL (via TenSEAL/SEALAPI)

#### 4.1 Các đối tượng chính

- `EncryptionParameters(scheme=BFV)`: chứa $N,t, \{q_i\}$.
- `SEALContext(parms, expand_chain=True, sec_level=TC128)`: xác thực tham số, dựng bảng NTT, chuỗi mức (RNS), kiểm tra an toàn 128-bit.
- `KeyGenerator(ctx)`: sinh `secret_key`, tạo `public_key`, (tùy) `RelinKeys`, `GaloisKeys`.
- `BatchEncoder(ctx)`: encode/decode vector <-> đa thức.
- `Encryptor(ctx,pk)`, `Decryptor(ctx,sk)`.
- `Evaluator(ctx)`: cộng/nhân (cipher<->cipher/plain), relinearize, rotate (cần GaloisKeys).

#### 4.2 Tham số hóa chuẩn

```go
N = 4096
plain_modulus = sealapi.PlainModulus.Batching(N, 18)
coeff = sealapi.CoeffModulus.BFVDefault(N, sealapi.SEC_LEVEL_TYPE.TC128)
parms = sealapi.EncryptionParameters(sealapi.SCHEME_TYPE.BFV)
parms.set_poly_modulus_degree(N)
parms.set_plain_modulus(plain_modulus)
parms.set_coeff_modulus(coeff)
ctx = sealapi.SEALContext(parms, True, sealapi.SEC_LEVEL_TYPE.TC128)

keygen   = sealapi.KeyGenerator(ctx)
sk       = keygen.secret_key()
pk       = sealapi.PublicKey(); keygen.create_public_key(pk)
encoder  = sealapi.BatchEncoder(ctx)
encryptor= sealapi.Encryptor(ctx,pk)
decryptor= sealapi.Decryptor(ctx,sk)
evaluator= sealapi.Evaluator(ctx)
```

#### 4.3 Luồng cơ bản

```go
# Sơ đồ mã hóa.
v  = [1,2,3] + [0]*(N-3)
pt = sealapi.Plaintext()
encoder.encode(v,pt) # vector slot -> một đa thức m(X)
print(pt.to_string()) # in đa thức m(X)
ct = sealapi.Ciphertext()
encryptor.encrypt(pt,ct) # mã hóa m(X) thành ciphertext: ct = (c0,c1)

# Tính toán (nhân với plaintext mask)
mask = [2]*N
pt_mask = sealapi.Plaintext()
encoder.encode(mask,pt_mask)
ct2 = sealapi.Ciphertext()
evaluator.multiply_plain(ct,pt_mask,ct2)

pt_out = sealapi.Plaintext()
decryptor.decrypt(ct2,pt_out)
res = encoder.decode_int64(pt_out)
print(res[:8])
#[2,4,6,0,0,0,0,0]
```

![image](https://hackmd.io/_uploads/ry67S1YJ-x.png)

#### 4.4 Slot vs hệ số đa thức

- Encode dùng INTT/CRT -> vector slot $v$ trở thành đa thức $m(X)$. Hệ số hằng `pt[0]` là một tổ hợp tuyến tính của slot (theo ma trận biến đổi), không phải trực tiếp $v[0]$ (bản rõ).
- Muốn truy cập slot, luôn decode.

## References

[1] https://en.wikipedia.org/wiki/Microsoft_SEAL
[2] https://github.com/microsoft/SEAL
[3] https://en.wikipedia.org/wiki/Group_homomorphism
[4] https://github.com/OpenMined/TenSEAL
[5] https://www.microsoft.com/en-us/research/wp-content/uploads/2017/06/sealmanual_v2.2.pdf
