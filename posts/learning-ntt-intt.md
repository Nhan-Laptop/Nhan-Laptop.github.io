# NTT/INTT - The Number Theoretic Transform

> Nhan_laptop|
> ---
> ----

> Note: resouce chinh: https://eprint.iacr.org/2024/585.pdf , https://www.nayuki.io/page/number-theoretic-transform-integer-dft

## Overvew

Muc dich cua blog nay se gioi thieu cho cac ban mot thuat toan manh me giup ta nhan 2 da thuc (trong truong so huu han) voi do phuc tap giam di dang ke so voi cac cach thong thuong.
Vi du truc quan:

- Nhan 2 da thuc: $(x^2+ x + 3)\times ( x^2 + 1 )$:

$$
\begin{aligned}
&\quad\ (x^2 + x + 3)\\
&\times\ (x^2 + 1)\\
&\underline{\hphantom{xxxxxxxxxxxxxxxx}}\\[-2pt]
&\quad\ (x^2 + x + 3) \qquad\text{(nhan voi }1)\\
&x^2(x^2 + x + 3) \qquad\ \text{(nhan voi }x^2)\\
&\underline{\hphantom{xxxxxxxxxxxxxxxx}}\\[-2pt]
&x^4 + x^3 + 4x^2 + x + 3
\end{aligned}
$$

- note: moi phep nhan nho duoc tinh la 1 don vi chi phi.

Goc nhin tong quat: cho 2 da thuc:

$$
\begin{aligned}
A(x) &= a_0 + a_1 + \cdots + a_{n-1}\cdot x^{n-1}\\
B(x) &= b_0 + b_1 + \cdots + b_{n-1}\cdot x^{n-1}
\end{aligned}
$$

Muc dich cua chung ta la tinh toan da thuc $C(x) = A(x) \cdot B(x)$, neu chung ta nghi cac he so cua 2 da thuc $A,B$ nhu la mot vector, thi C-vector duoc goi la "Tich chap - Convolution" cua $A,B$.
De dang tinh duoc do phuc tap cua thuat toan tren la: $O(n^2)$.

Thuat toan NTT/INTT la mot khai quat cua DFT co dien lam viec tren modulo nguyen to $q$ co chua goc n-th primitive root of unity $\omega$. Ket qua chinh xac trong $\mathbb{Z}_q$, lam giam dang ke do phuc tap trong tinh toan bang cach ung dung Fast Fourier Transform-style algorithms.

## Review of the Discrete Fourier transform - DFT over a ring

### Definition

Dat $R$ la mot ring bat ki, voi so nguyen $n \ge 1$, ta co $\alpha \in R$, voi $\alpha$ duoc goi la principal n-th root of unity, duoc dinh nghia nhu sau:

$$
\begin{array}{c}
\left\{
\begin{aligned}
\alpha ^ n  &\equiv 1\\
\sum_{j=0} ^ {n-1} \alpha ^{j\cdot k} &\equiv 0\ \text{for }1 \le k < n
\end{aligned}
\right.
\end{array}
$$

The DFT anh xa mot n-tuple $(v_0,\cdots,v_{n-1})$ cac phan tu thuoc $R$ sang mot n-tuple khac $(f_0,\cdots,f_{n-1})$ cac phan tu cung thuoc $R$ theo cong thuc:

$$
f_k = \sum_{j=0} ^ {n-1} v_j \cdot \alpha ^{j\cdot k}
$$

Theo quy uoc, tuple $(v_0,\cdots,v_{n-1})$ duoc goi la cac phan tu time domain va cac chi so $j$ duoc goi la time. Tuple $(f_0,\cdots,f_{n-1})$ duoc goi la cac phan tu trong frequency domain va cac chi so $k$ duoc goi la frequency. Mot cach goi khac tuple $(f_0,\cdots,f_{n-1})$ la quang pho-spectrum cua $(v_0,\cdots,v_{n-1})$, thuat ngu bat nguon tu cach phep bien doi ung dung cua Fourier transforms trong signal processing.

### Inverse - IDFT

Gia tri nghich dao cua The DFT duoc tinh nhu sau:

$$
v_j = \frac{1}{n}\cdot \sum_{k=0} ^ {n-1}f_{k}\cdot \alpha ^{-j\cdot k}
$$

Voi $\frac{1}{n}$ la nghich dao cua $n$ trong $R$ (chu y: neu $n$ khong co nghich dao trong $R$ thi khong the thuc hien DFT).

> **Info:**
> **Proof:**
>
> $$
> \begin{aligned}
> &\ \frac{1}{n}\cdot \sum_{k=0} ^ {n-1}f_{k}\cdot \alpha ^{-j\cdot k}\\
> &=  \frac{1}{n}\cdot \sum_{k=0} ^ {n-1}
> \sum_{j'=0} ^ {n-1} v_{j'} \cdot \alpha ^{j'\cdot k} \cdot \alpha ^{-j\cdot k}\\
> &= \frac{1}{n} \sum_{j'=0} ^ {n-1} v_{j'} \cdot \sum_{k=0} ^ {n-1}
> \alpha ^{(j'-j)\cdot k}
> \end{aligned}
> $$
>
> Ta co $\sum_{k=0} ^ {n-1} \alpha ^{(j'-j)\cdot k}\equiv 0$ khi $j'\neq j$ (luc nay to hop $(j'-j)\cdot k$ ta hoan toan co the xep tuan tu cac gia tri giong nhu phan tren da noi), va khi $j'=j \Rightarrow \sum_{k=0} ^ {n-1} \alpha ^{0}\equiv n$. Nen bieu thuc tren se bang $v_j$.

Vay ta co mot phep anh xa nhu sau:

$$
\begin{aligned}
(v_0,\cdots,v_{n-1})\xrightarrow{DFT}(f_0,\cdots,f_{n-1})\\
(f_0,\cdots,f_{n-1})\xrightarrow{IDFT}(v_0,\cdots,v_{n-1})
\end{aligned}
$$

### Matrix formulation

Ta hoan toan co the bieu dien phep bien doi DFT o dang ma tran (vi phep anh xa la cac toan tu tuyen tinh). Trong ki hieu ma tran, DFT duoc bieu dien nhu:

$$
\begin{array}{c}
\begin{bmatrix}
f_0\\
f_1\\
\vdots\\
f_{n-1}
\end{bmatrix}=
\begin{bmatrix}
1 & 1 & 1 & \cdots & 1\\
1 & \alpha & \alpha^{2} & \cdots & \alpha^{\,n-1}\\
1 & \alpha^{2} & \alpha^{4} & \cdots & \alpha^{\,2(n-1)}\\
\vdots & \vdots & \vdots & \ddots & \vdots\\
1 & \alpha^{\,n-1} & \alpha^{\,2(n-1)} & \cdots & \alpha^{\,(n-1)(n-1)}
\end{bmatrix}
\begin{bmatrix}
v_0\\
v_1\\
\vdots\\
v_{n-1}
\end{bmatrix}\,.
\end{array}
$$

Dang ma tran cho phep bien doi nay duoc goi la DFT matrix.

Tuong tu cho nghich dao DFT:

$$
\begin{array}{c}
\begin{bmatrix}
v_0\\
v_1\\
\vdots\\
v_{n-1}
\end{bmatrix}=\frac{1}{n} \cdot
\begin{bmatrix}
1 & 1 & 1 & \cdots & 1\\
1 & \alpha^{-1} & \alpha^{-2} & \cdots & \alpha^{-(n-1)}\\
1 & \alpha^{-2} & \alpha^{-3} & \cdots & \alpha^{-2(n-1)}\\
\vdots & \vdots & \vdots & \ddots & \vdots\\
1 & \alpha^{-(n-1)} & \alpha^{-2(n-1)} & \cdots & \alpha^{-(n-1)(n-1)}
\end{bmatrix}
\begin{bmatrix}
f_0\\
f_1\\
\vdots\\
f_{n-1}
\end{bmatrix}.
\end{array}
$$

### Polynomial formulation

Mot cach nao do ta co the dinh nghia mot tuple $(v_0,\cdots,v_{n-1})$ voi mot da thuc:

$$
p_v(x) = v_0 + v_1 \cdot x + v_2 \cdot x^2 + \cdots + v_{n-1}\cdot x^{n-1}.
$$

Neu ta viet tung cong thuc cua $f_k$:

$$
f_k = v_0 + v_1 \cdot \alpha ^ k + v_2 \cdot \alpha ^ {2k}+ \cdots + v_{n-1} \cdot \alpha ^ {(n-1)\cdot k} = \sum_{j=0} ^ {n-1} v_j \cdot \alpha ^{j\cdot k}
$$

Viec nay tuong duong den $f_k$ la mot gia tri cua bieu thuc $p_v(x)$ voi $x=\alpha ^ k$:

$$
f_k = p_v (\alpha ^ k).
$$

> **Warning:**
> Vi vay ta co the hoan toan xem cac he so va gia tri cua da thuc la:
> - He so la phan tu trong time-domain,
> - Gia tri la phan tu trong frequency domain.
>
> Chu y: Ta chi co the bien doi DFT tren da thuc, neu no duoc tinh toan tren nth-root of unity, chinh xac la so mu cua $\alpha$.

Tuong tu ta cung co $p_f(x) = p_v^{-1}(x)$:

$$
p_f(x) = f_0 + f_1 \cdot x + f_2 \cdot x^2 + \cdots + f_{n-1}\cdot x^{n-1}.
$$

## NTT/INTT - The Number Theoretic Trbnsform

### Introduction

Trong blog nay minh se gioi thieu mot so khai niem co ban, bao gom ca cai dat thuat toan (Rust), giai thich mot cach truc quan nhat co the.

Note:

- NTT - The Number Theoretic Transform nhu DFT trong vong da thuc.
- Cai tien cua NTT/INTT transformation bang cach su dung the Fast - Fourier Transformation (FFT)-style calculation: The Cooley-Tukey (CT) va the Gentleman-Sande (GS) butterflies algorithm.

### Convolution

Nhu da de cap o dau blog, tich chap vong - Convolution nghia la ket qua cua phep tinh giua 2 da thuc.

### Cyclic Convolution

Cho 2 da thuc $A(x)$ va $B(x)$ co bac la $n-1$ trong vanh thuong $\mathbb{Z}_q(x)/(x^n -1)$ voi $q$ so nguyen:

$$
\begin{aligned}
A(x) &= a_0 + a_1 + \cdots + a_{n-1}\cdot x^{n-1}\\
B(x) &= b_0 + b_1 + \cdots + b_{n-1}\cdot x^{n-1}
\end{aligned}
$$

Mot "Cyclic convolution" - tich chap tuan hoan hoac positive wrapped convolution, $PWC(x)$ duoc dinh nghia nhu sau:

$$
PWC(x)= \sum_{k=0}^{n-1}c_k \cdot x^k
$$

Voi $c_k =\sum_{i=0}^{k}a_i \cdot b_{k-i} + \sum_{i=k+1}^{n-1}a_i \cdot b_{k+n-i}\mod q$. Neu $C(x)$ la ket qua cua tich chap tren trong vong $\mathbb{Z}_q(x)$, no cung duoc dinh nghia nhu sau:

$$
PWC(x) = C(X) \mod{x^n - 1}
$$

Vi du:

$$
\begin{aligned}
A(x) &= 3x^2 + 2x + 4 \mod {x^4 -1 }\\
B(x) &= 4x^3 + 3x + 5 \mod {x^4 -1 }
\end{aligned}
$$

$$
\begin{array}{rrrrrrrr}
    &&&&   3x^2 &+& 2x &+ 4 \\
    &&&&   4x^3 &+& 3x &+ 5 \\
\hline
    &&&  12x^5 &+& 8x^4 &+ 21x^3 &+ 22x^2 &+ 22x &+& 20\\
    &&&  12x   &+& 8    &+ 21x^3 &+ 22x^2 &+ 22x &+& 20 &\mod {x^4 -1 }\\
\hline
    &&&  21x^3 &+& 22x^2 &+ 34x &+ 28 &\mod {x^4 -1 }
\end{array}
$$

### Negacyclic Convolution

Cho 2 da thuc $A(x)$ va $B(x)$ co bac la $n-1$ trong vanh thuong $\mathbb{Z}_q(x)/(x^n +1)$ voi $q$ so nguyen:

$$
\begin{aligned}
A(x) &= a_0 + a_1 + \cdots + a_{n-1}\cdot x^{n-1}\\
B(x) &= b_0 + b_1 + \cdots + b_{n-1}\cdot x^{n-1}
\end{aligned}
$$

Mot negacyclic convolution hoac negative wrapped convolution, $NWC(x)$ duoc dinh nghia nhu sau:

$$
NWC(x)= \sum_{k=0}^{n-1}c_k \cdot x^k
$$

Voi $c_k =\sum_{i=0}^{k}a_i \cdot b_{k-i} + \sum_{i=k+1}^{n-1}a_i \cdot b_{k+n-i}\mod q$. Neu $C(x)$ la ket qua cua tich chap tren trong vong $\mathbb{Z}_q(x)$, no cung duoc dinh nghia nhu sau:

$$
NWC(x) = C(X) \mod{x^n + 1}
$$

Vi du:

$$
\begin{aligned}
A(x) &= 3x^2 + 2x + 4 \mod {x^4 +1 }\\
B(x) &= 4x^3 + 3x + 5 \mod {x^4 +1 }
\end{aligned}
$$

$$
\begin{array}{rrrrrrrr}
    &&&&   3x^2 &+& 2x &+ 4 \\
    &&&&   4x^3 &+& 3x &+ 5 \\
\hline
    &&&  12x^5 &+& 8x^4 &+ 21x^3 &+ 22x^2 &+ 22x &+& 20\\
    &&&  -12x   &+& -8    &+ 21x^3 &+ 22x^2 &+ 22x &+& 20 &\mod {x^4 + 1 }\\
\hline
    &&&  21x^3 &+& 22x^2 &+ 10x &+ 20 &\mod {x^4 +1 }
\end{array}
$$

### NTT-Based Convolutions

#### Primitive n-th Root of Unity

- nhac lai:

Mot primitive n-th root of unity (ta ky hieu la $\alpha$) trong $\mathbb{Z}_q$ la:

$$
\begin{array}{c}
\left\{
\begin{aligned}
\alpha ^ n  &\equiv 1\\
\sum_{j=0} ^ {n-1} \alpha ^{j\cdot k} &\equiv 0\ \text{for }1 \le k < n
\end{aligned}
\right.
\end{array}
$$

#### NTT-Based Positive-Wrapped Convolution

##### Number Theoretic Transform based on $\alpha$

Phan nay tuc la chuyen vector he so $v = (v_0,\cdots , v_{n-1})$ sang $f = (f_0,\cdots , f_{n-1})$, minh da gioi thieu o phan DFT, o day minh se ki hieu lai phep anh xa nay la:

$$
(v_0,\cdots,v_{n-1})\xrightarrow{NTT}(f_0,\cdots,f_{n-1})
$$

##### Inverse Number Theoretic Transform based on $\alpha$

Nhu phan tren minh ky hieu lai INTT tu IDFT la:

$$
(f_0,\cdots,f_{n-1})\xrightarrow{INTT}(v_0,\cdots,v_{n-1})
$$

##### Using NTT to Calculate Positive-Wrapped Convolutions

Boi vi NTT la mot dang cua DFT trong vanh da thuc. Nen ta co the ung dung DFT's convolution theorem de tinh positive-wrapped convolution: cho $a,b$ la cac vector he so cua da thuc. The positive-wrapped convolution cua $a,b$ duoc tinh la:

$$
c = INTT(NTT(a)\bullet NTT(b))
$$

voi $\bullet$ la phep tinh nhan tren $\mathbb{Z}_q$.

#### NTT-based Negative-Wrapped Convolution

Trong phan nay minh se gioi thieu dinh nghia NTT va INTT tren co so 2n-th root of unity, $\zeta$, lam the nao de su dung chung de tinh negative-wrapped hoac negacyclic convolution.

##### Primitive 2n-th Root of Unity

De tinh toan duoc negative-wrapped convolution, chung ta can the primitive 2n-th root of unity, $\zeta$.

Voi $\mathbb{Z}_q$ la vanh nguyen modulo $q$, va $n-1$ la bac cua da thuc $A(x)-B(x)$ va $\alpha$ la primitive n-th root of unity. Chung ta dinh nghia $\zeta$ la the primitive 2n-th root of unity khi va chi khi:

$$
\begin{array}{c}
\left\{
\begin{aligned}
\zeta^2 &\equiv \alpha \mod{q}\\
\zeta^n &\equiv -1 \mod{q}
\end{aligned}
\right.
\end{array}
$$

##### Number Theoretic Transform Based on $\zeta$

The negative-wrapped number theoretic transform ($NTT^\zeta$) cua mot vector he so da thuc $f=NTT^\zeta(v)$, ta co:

$$
f_k = \sum_{j=0} ^ {n-1} v_j \cdot \alpha ^{j\cdot k} \cdot \zeta^j \mod {q}
$$

voi $k=0,\cdots, n-1$, vi $\zeta^2 \equiv \alpha \mod{q}$, chung ta thay vao bieu thuc tren:

$$
f_k = \sum_{j=0} ^ {n-1} v_j \cdot \zeta^{2jk + j} \mod {q}
$$

##### Inverse Number Theoretic Transform Based on $\zeta$

The negative-wrapped inverse of number theoretic transform (INTT) cua mot NTT vector $f$ la $v = INTT^{\zeta^{-1}}(f)$, ta co:

$$
v_j = \frac{1}{n}\cdot \sum_{k=0} ^ {n-1}f_{k}\cdot \alpha ^{-j\cdot k} \cdot \zeta^{-k} \mod {q}
$$

voi $j = 0,\cdots,n-1$, tuong tu ta co bieu thuc:

$$
v_j = \frac{1}{n}\cdot \sum_{k=0} ^ {n-1}f_{k}\cdot \zeta^{-(2jk+k)} \mod {q}
$$

##### Using $NTT^\zeta$ to Calculate Negative-Wrapped Convolutions

Tuong tu voi positive-wrapped thi ta co the tinh the negative-wrapped convolutions:

Voi $a,b$ la cac vector he so da thuc, the negative-wrapped convolution cua $a,b$ - $c$ duoc tinh:

$$
c = INTT^{\zeta^{-1}}(NTT^{\zeta}(a)\bullet NTT^{\zeta}(b))
$$

#### Cach chon mot modulus

Ta phai chon mot modulus-$q$ thoa cac dieu kien nhu sau:

- Ton tai the n-th root $\alpha$ trong $\mathbb{Z}_q$. Vi khi va chi khi co the n-th root $\alpha$ thi moi su dung NTT de thuc hien duoc positive-wrapped convolutions.
- Va phai ton tai the 2n-th root $\zeta$ de thuc hien negative-wrapped convolutions.

Neu $q$ la so nguyen to, thi $n$ phai la uoc cua $q-1$. Neu $q$ la to hop:

$$
q = q_1 ^ {m_1}\cdot q_2 ^ {m_2}\cdots q_k ^ {m_k}
$$

$n$ se phai la uoc cua the greatest common divisor (GCD) cua $(q_1-1,q_2-1,\cdots,q_k-1)$.

Trong so do duoc de xuat cho NIST-PQC competition, nhung gia tri $n$ va $q$ duoc chuan hoa, bang tom tat cho cac gia tri:
![image](https://hackmd.io/_uploads/rk9t5aNgZx.png)

> **Info:**
> - PWC-NTT friendly modulus $q$: duoc dinh nghia la neu va chi neu ton tai n-th root of unity $\alpha$ trong $\mathbb{Z}_q$.
> - NWC-NTT friendly modulus $q$: duoc dinh nghia la neu va chi neu ton tai 2n-th root of unity $\zeta$ trong $\mathbb{Z}_q$.

De phu hop cho viec toi uu thuat toan, thi $n$ thuong duoc chon la luy thua cua 2, va $q$ duoc chon theo cong thuc: $q \equiv 1 \mod{2n}$, thi luc nay ta se co day du cac n-th root of unity, 2n-th root of unity:

$$
x^n+1=(x-\zeta)\cdot (x-\zeta^3)\cdots (x-\zeta^{2n-1})\mod q
$$

### Fast NTT: An Adaptation of Fast-Fourier Transform to the Number Theoretic Transform

Trong cac phan truoc, cac trinh bay ve NTT va INTT transformation van co do phuc tap kha lon $O(n^2)$, vi vay khong co su khac biet giua phuong phap truyen thong cua negacyclic convolution. Tuy nhien vi NTT la mot phan dac biet cua DFT nen optimize tren DFT van co the duoc ap dung vao NTT. Mot ki thuat toi uu kinh dien la Fast-Fourier Transform (FFT) duoc de xuat boi Cooley-Tukey va Gentleman-Sande. Ca hai deu su dung butterflies divide va conquer technique de giam do phuc tap con $O(n\log n)$.

De giam do phuc tap duoc nhu the ta su dung "divide va conquer" techniques bang cach su dung tinh chat tuan hoan-periodicity va doi xung-symmetry cua $\zeta$:

- Tuan hoan: $\zeta^{k+2\cdot n} = \zeta^k$.
- Doi xung: $\zeta^{k+n} = -\zeta^k$.

Voi $k$ la so nguyen khong am. Phep tinh $n$ diem NTT va INTT co the chia lam $n/2$ diem. Tuy nhien ki thuat chia nay co doi phan kho.

#### Cooley-Tukey (CT) Algorithm for Fast-NTT

Tu viec tinh $NTT^{-1}$ tren 1 gia tri ta co the chia lam 2 phan:

$$
\begin{aligned}
f_k &= \sum_{j=0} ^ {n-1} v_j \cdot \zeta^{2jk + j} \mod {q}\\
&= \sum_{j=0} ^ {n/2-1} v_{2j} \cdot \zeta^{4jk + 2j} + \sum_{j=0} ^ {n/2-1} v_{2j+1} \cdot \zeta^{4jk +2k + 2j +1} \mod{q}\\
&= \sum_{j=0} ^ {n/2-1} v_{2j} \cdot \zeta^{4jk + 2j} + \zeta^{2k+1} \sum_{j=0} ^ {n/2-1} v_{2j+1} \cdot \zeta^{4jk + 2j} \mod{q}
\end{aligned}
$$

Dua tren tinh chat doi xung cua $\zeta$ ta co:

$$
f_{k+n/2} = \sum_{j=0} ^ {n/2-1} v_{2j} \cdot \zeta^{4jk + 2j} - \zeta^{2k+1} \sum_{j=0} ^ {n/2-1} v_{2j+1} \cdot \zeta^{4jk + 2j} \mod{q}
$$

Dat $A_k = \sum_{j=0} ^ {n/2-1} v_{2j} \cdot \zeta^{4jk + 2j}$, $B_k = \sum_{j=0} ^ {n/2-1} v_{2j+1} \cdot \zeta^{4jk + 2j}$, nen ta co:

$$
\begin{aligned}
f_k &= A_k + \zeta^{2k+1}\cdot B_k \mod{q}\\
f_{k+n/2} &= A_k - \zeta^{2k+1}\cdot B_k \mod{q}
\end{aligned}
$$

Luu y: cac gia tri $A_k, B_k$ co the duoc tinh bang $n/2$ diem NTT. Neu $n$ la power of 2, qua trinh nay co the lap lai cho tat ca cac he so. Hinh duoi mo ta qua trinh truc quan cua bieu thuc, thuong duoc goi la CT butterfly:

![image](https://hackmd.io/_uploads/HJL76C4xbl.png)

Note: $\psi = \zeta$

Y tuong la tinh toan cac so hang tuong tu (nhu $A_k, B_k$) mot lan roi phan phoi ket qua thay vi tinh toan nhieu lan:
![image](https://hackmd.io/_uploads/Bk8Zm0ElZg.png)

So giai doan can thiet cho giai doan nay la $\log_2(n)$.
![image](https://hackmd.io/_uploads/ByepXyBgZl.png)

#### Gentleman-Sande (GS) Algorithm for Fast-INTT

Voi INTT, thay vi chia tong cua no thong qua chi so chan le, no duoc tach bang nua tren nua duoi cua phep cong:

$$
\begin{aligned}
v_j
&= \frac{1}{n}
\left[
\sum_{k=0}^{\frac{n}{2}-1} f_k\,\zeta^{-(2j+1)k}
+
\sum_{k=0}^{\frac{n}{2}-1} f_{k+\frac{n}{2}}\,
\zeta^{-(2j+1)\left(k+\frac{n}{2}\right)}
\right] \\
&= \frac{1}{n}
\left[
\sum_{k=0}^{\frac{n}{2}-1} f_k\,\zeta^{-(2j+1)k}
+
\zeta^{-(2j+1)\frac{n}{2}}
\sum_{k=0}^{\frac{n}{2}-1} f_{k+\frac{n}{2}}\,
\zeta^{-(2j+1)k}
\right] \\
&= \frac{1}{n}
\left[
\sum_{k=0}^{\frac{n}{2}-1} f_k\,\zeta^{-(2j+1)k}
-
\sum_{k=0}^{\frac{n}{2}-1} f_{k+\frac{n}{2}}\,
\zeta^{-(2j+1)k}
\right].
\end{aligned}
$$

Dua tren tinh chat tuan hoan va doi xung $\zeta^{-1}$, doi voi so hang chan ta co:

$$
\begin{aligned}
v_{2j} &= \frac{1}{n}\cdot \zeta^{-2j} \cdot \sum_{k=0}^{\frac{n}{2}-1}
\left[f_k + f_{\left(k+\frac{n}{2}\right)}\right]\cdot \zeta^{-4jk} \mod {q}
\end{aligned}
$$

Tuong tu cho cac he so le:

$$
\begin{aligned}
v_{2j+1} &= \frac{1}{n}\cdot \zeta^{-2j} \cdot \sum_{k=0}^{\frac{n}{2}-1}
\left[f_k - f_{\left(k+\frac{n}{2}\right)}\right]\cdot \zeta^{-4jk} \mod {q}
\end{aligned}
$$

Dat $A_j = \sum_{k=0}^{\frac{n}{2}-1} \zeta^{-4jk}\,f_k$ va $B_j = \sum_{k=0}^{\frac{n}{2}-1} \zeta^{-4jk}\,f_{k+n/2}$, nen ta co:

$$
\begin{aligned}
v_{2j} &= \frac{1}{n}\cdot \zeta^{-2j}(A_j + B_j) \mod {q}\\
v_{2j+1} &= \frac{1}{n}\cdot \zeta^{-2j}(A_j - B_j) \mod {q}
\end{aligned}
$$

Luu y: cac gia tri $A_j,B_j$ co the thu duoc duoi dang $n/2$ diem INTT. Neu $n$ la power of 2, qua trinh nay co duoc lap lai. Phuong trinh nay thuong duoc goi la GS butterfly.
![image](https://hackmd.io/_uploads/r1uGaCVl-l.png)

Y tuong la tinh toan cac so hang tuong tu (nhu $A_j,B_j$) mot lan roi phan phoi ket qua thay vi tinh toan nhieu lan:

![image](https://hackmd.io/_uploads/SyM_aRVg-l.png)

#### Tong hop

Mot cach nhin tong quat cho bieu thuc:

$$
c = INTT^{\zeta^{-1}}(NTT^{\zeta}(a)\bullet NTT^{\zeta}(b))
$$

- $NTT^\zeta$ co toi uu nen phan nay co do phuc tap la $O(n \log n)$ (can $(n/2)\log_2(n)$ phep nhan va $n\log_2(n)$ phep cong), tuong tu voi $INTT^{\zeta^{-1}}$.
- Phep nhan trong NTT duoc coi la $O(n)$ vi chi la nhan cac he so.

Tu day ta co the tinh tong quat do phuc tap: $O(n) + 3O(n\log n) = O(n\log n)$.

## References

1. https://eprint.iacr.org/2024/585.pdf
2. https://dunglq2000.github.io/mathematics/discrete-mathematics/discrete-fourier-transform.html
3. https://en.wikipedia.org/wiki/Cooley%E2%80%93Tukey_FFT_algorithm
4. https://www.cs.cmu.edu/afs/cs/academic/class/15451-s10/www/lectures/lect0423.txt
5. v...v.v...
