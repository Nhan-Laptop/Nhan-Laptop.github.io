---
date: 2026-07-13
summary: An introductory note on MP-LWE, connecting classical LWE and RLWE intuition to the middle-product construction and its efficiency goals.
tags:
  - lattice
  - lwe
  - mp-lwe
  - rlwe
---

# Middle-Product LWE
> Nhan_laptop
> ---

## Motivation and overview 
Mật mã đã trải qua nhiều thăng trầm, hơn hết đứng trước cuộc tấn công mạnh mẽ của máy tính lượng tử, các hệ mã truyền thống (RSA,ECC,AES,...) đang dần lỗi thời trong vài chục năm tới. 
Có nhiều hướng nghiên cứu khác nhau, nhưng nhìn chung lattice đang dẫn đầu trong cuộc đua nghiên cứu. 
Ở blog này mình sẽ giới thiệu một số khái niệm lẫn các chứng minh trong nhánh nghiên cứu Middle-Product LWE và từ đó đưa ra một số đánh giá để cải tiến tốc độ và hiệu suất của hệ mã nói trên. 
Nền tảng lattice dựa trên độ khó của hai vấn đề : 
- the Small Integer Solution problem (SIS). 
- the Learning With Errors problem (LWE).


## Lattice 
Có cũng khá là nhiều blog nói về vấn đề này, thay vì mình nói lại thì bây giờ hãy điểm qua một số blog như sau: 
- https://hackmd.io/@Giapppp/BJ4wfpZST
- https://hackmd.io/@nomorecaffeine/r1xstVfxC
- https://ur4ndom.dev/static/files/latticetraining/practical_lattice_reductions.pdf

## Polynomial-LWE and Ring-LWE 
> https://arxiv.org/pdf/2401.03703
> https://eprint.iacr.org/2012/230.pdf
> https://eprint.iacr.org/2018/170.pdf
>https://hackmd.io/@NhanLAPTOP/rJYQNtJgWx

Vì mình chỉ muốn tập chung vào ý chính của blog, nên mình sẽ nhắc lại một số khái niệm cho các bạn biết, nếu muốn xem chi tiết có thể xem qua các paper và blog mình đã trích dẫn. 

* recall: 

Nền tảng của PLWE hay RLWE là bài toán LWE, bài toán được phát biểu như sau: Tìm một vector bí mật s khi được cho trước một ma trận $A$ và một vector $b$, trong đó: 

$$
b = A \cdot s + e \mod q
$$

với e là nhiễu. 

Khi không có nhiễu-e, thì đây chỉ đơn giản là bài toán giải hệ tuyến tính khử Guass. Nhưng khi có e, bài toán trở nên phức tạp hơn, quy về tìm vectro ngắn nhất trên lưới (SVP).

Độ phức tạp của LWE: Khích thước khóa ma trận A quá lớn $Q(n^2)$ -> làm cho tốc độ tính toán chậm. 


Để giải quyết vấn đề trên thì các nhà nghiên cứu mật mã học đã đưa ra được nhiều phương pháp phát triể, trong đso có các phép nhân ma trận - vector bằng phép nhân đa thức trong một vành (Ring).

### PLWE 
PLWE là phiên bản LWE được định nghĩa trên một vành đa thức chung $R_q = \mathbb{Z}_q[x] / \langle f(x) \rangle$.

- Thay vì dùng ma trận $\mathbf{A}$, ta dùng một đa thức $a(x)$.
- Khóa bí mật $s(x)$ và nhiễu $e(x)$ cũng là các đa thức với hệ số nhỏ.
- Phương trình:
$$ b(x) = a(x) \cdot s(x) + e(x) \pmod{q, f(x)} $$

- PLWE chú trọng vào dạng biểu diễn đa thức làm sao tối ưu hóa phép nhân bằng biến đổi số học (NTT/FFT), giảm độ phức tạp xuống $O(n\log{n})$.

### RLWE 

Ring-LWE - đây là định nghĩa chặt chẽ hơn, cái gốc của PLWE, được xây dựng trên vành các số nguyên của một trường đại số: 
- Trong RLWE: vàng $R$ thường là vành cyclotomic $\mathbb{Z}[x] / \langle \Phi_m(x) \rangle$, với $\Phi_m(x)$ là đa thức cyclotomic thứ m (ta dễ biế là $x^n +1$ với n là lũy thừa của 2).



### Toy example

Ta sẽ làm việc trên vành: $R_q = \mathbb{Z}_{17}[x] / \langle x^4 + 1 \rangle$.

- Bậc là 3. 
- modulo là q= 17.
-  $x^4 \equiv -1 \pmod{17}$.

Ta chọn ngẫu nhiên đa thức $a(x) \in R_{17}$: 

$$ a(x) = 4x^3 + 11x^2 + 10x + 7 $$

Khóa bí mật $s(x)$  là các hệ số nhỏ thuộc $\{-1, 0, 1\}$:

$$ s(x) = x^3 - x^2 + 1 $$

Nhiễu $e(x)$ : 

$$ e(x) = x^2 - x $$

tính khóa công khai: 

$b(x) = a(x) \cdot s(x) + e(x) \pmod{17, x^4 + 1}$.

\begin{aligned}
a(x) \cdot s(x) &= (4x^3 + 11x^2 + 10x + 7)(x^3 - x^2 + 1) \\
 &= 4x^6 + 7x^5 - 1x^4 + x^3 + 4x^2 + 10x + 7 \\
 &= 4(-x^2) + 7(-x) - (-1) + x^3 + 4x^2 + 10x + 7 \\
 &= -4x^2 - 7x + 1 + x^3 + 4x^2 + 10x + 7 \\
 &= x^3 + 3x + 8 \\
 &\downarrow\\
 b(x) &= (x^3 + 3x + 8) + (x^2 - x)\\
 b(x) &= x^3 + x^2 + 2x + 8 \pmod{17} 
\end{aligned}

## MP-LWE
> https://eprint.iacr.org/2017/628.pdf

Đặt n,q > 2 và  $\mathbb{Z}_q^n[x]$ ký hiệu cho tập hợp các đa thức với hệ số thuộc $\mathbb{Z}_q$ và bậc <n. với $a\in \mathbb{Z}_q^{<n}[x]$ và $s \in \mathbb{Z}_q^{<2\cdot n -1}[x]$, chúng ta đặt : 

\begin{equation}
a \odot s  =  \lfloor
\frac{
a \cdot s \bmod (x^{2n}-1)
}{
x^{n}-1
}
\rfloor \in 
\mathbb{Z}_q^{<n}[x]
\end{equation}

ký hiệu cho đa thức thu được bằng cách nhân a và s và chỉ giữa n phần hệ số ở giữa. 

Middle-Product LWE (MP-LWE), với thôn số n,q >2 và $\alpha \in (0,1)$, bao gồm việc phân biệt một số lượng mẫu tùy ý $(a_i,b_i)$ phân bố đều trong $\mathbb{Z}_q^{<n}[x] \times (\mathbb{R}/q\cdot\mathbb{Z})^{<n}[x]$, từ cùng lượng mẫu $(a_i,b_i)$ với $a_i$ phân bố đều trong $\mathbb{Z}^{<n}[x]$ và $b_i = a_i \odot_n s + e_i$, với mỗi hệ số của $e_i$ được lấy mẫu từ phân phối Guassian với độ lệ chuẩn $\alpha \cdot q$, và s được chọn phân phối đều trong $\mathbb{Z}_q^{<2\cdot n -1}[x]$.

* Notations: 

Chúng ta sẽ sử dụng ký hiệu $U(X)$ cho phân phối đều trên tập $X$. Nếu $D_1$ và $D_2$ là 2 phân phối trên cùng một miền đếm được, ta đặt $∆(D1, D2)$ ký hiệu cho  khoảng cách thống kê của chúng.

Đặt $\| b\|$ và $\| b\|_∞$ ký hiệu lần lượt cho chuẩn Euclidean và chuẩn vô cực cho bất kỳ vector nào trên tập số thực. Tương tự, nếu b là một đa thức trên tập số thực, chúng ta đặt $\| b\|$ ký hiệu cho chuẩn Euclidean của các hệ số vector. Với ma trận $M$ đặt $M_{i,j}$ ký hiệu cho phần tử nằm ở hàng $i-th$ và cột $j-th$. Đặt $\| M\|$ ký hiệu cho giá trị riêng lớn nhất của $M$

### Background 
#### Probabilities - xác suất

Nhắc lại: một họ (hữu hạn) $H$ các hàm băm h: $X\rightarrow Y$ là  universal nếu: 

\begin{equation}
\Pr_{h \leftarrow U(\mathcal{H})}
[h(x_1)=h(x_2)]=
\frac{1}{|Y|},
\qquad
\forall\, x_1 \neq x_2 \in X.
\end{equation}

:::info
Lemma 1: Đặt X,Y,Z ký hiệu cho các tập hữu hạn. Đặt $H$ là một họ băm universal của hàm băm h: $X\rightarrow Y$. Đặt f: $X\rightarrow Z$ tùy ý. Sau đó với mọi giá trị ngẫu nhiên T lấy các giá trị X, chúng ta có: 
\begin{equation}
\Delta\!\bigl(
(h,h(T),f(T)),
(h,U(Y),f(T))
\bigr)
\le
\frac{1}{2}\cdot
\sqrt{\gamma(T)\cdot |Y|\cdot |Z|}.
\end{equation}

Với $\gamma(T) = max_{t\in X} Pr[T=t]$
:::

Trong các bài toán chúng ta nghiên cứu, các phân phối nhiễu được gọi là Gaussian. 
:::success
* Định nghĩa: 

Chúng ta định nghĩa một hàm Gaussian trên $\mathbb{R}^n$ của ma trận hiệp phương sai (of covariance
matrix) $\sum$ như sau: 

\begin{equation}
\rho_{\Sigma}(\mathbf{x})
:=
\exp\!\left(
-\pi \cdot \mathbf{x}^{T}\Sigma^{-1}\mathbf{x}
\right)
\end{equation}
:::
Với mỗi vector $x\in \mathbb{R}^n$. Phân phối xác suất có mật độ tỉ lệ  thuận với $\rho_{\Sigma}$ được gọi là phân phối Guassian và được ký hiệu là $D_{\Sigma}$. Khi $\Sigma = s^2 \cdot ld_n$, chúng ta viết $\rho_s$ và $D_s$ thay vì $\rho_{\Sigma}$, $D_{\Sigma}$ . 

#### Polynomails and Structured Matrices. 

Đặt R là một vành. với k > 0, chúng ta đặt $R^{<k}[x]$ ký hiệu cho tập các ma trận trên $R[x]$ với bậc < k. 

Cho một đa thức $a = a_0 + a_1 \cdot x + \cdots + a_{k-1}\cdot x ^{k-1} \in R^{k}[x]$ và một và j<k, chúng ta sử dụng ký hiệu sau: 

\begin{cases}
a &= (a_0,\cdots,a_{k-1})^T \in R^k\\
\overline{a} &= (a_{k-1},\cdots,a_0)^T \in R^k
\end{cases}

:::success
* Định nghĩa 2, đặt f là một đa thức bậc m, với mọi d>0 và mọi $a\in R[x]$, chúng ta đặt $Rot^d_f (a)$ ký hiệu ma trận trong $R^{d\times m}$ với hàng i-th được lấy từ hệ số của đa thức $(x^{i-1}\cdot a) \mod f$, với mọi $i = 1,\cdots, d$. chúng ta sẽ sử dụng ký hiệu $Rot_f(a)$ thay vì $Rot^m_f(a)$.
:::

(Trường hợp đặc biệt): Khi đa thức được chọn là $f(x) = x^m + 1$, ma trận $\text{Rot}_{f}(a)$ có dạng tường minh (dạng phản tuần hoàn) như sau:

\begin{array}
	\text{Rot}_{f}(a) = 
	\begin{pmatrix}
	a_0 & a_1 & a_2 & \cdots & a_{m-1} \\
	-a_{m-1} & a_0 & a_1 & \cdots & a_{m-2} \\
	-a_{m-2} & -a_{m-1} & a_0 & \cdots & a_{m-3} \\
	\vdots & \vdots & \vdots & \ddots & \vdots \\
	-a_1 & -a_2 & -a_3 & \cdots & a_0
	\end{pmatrix}
\end{array}

Chú ý: nếu $a'=a \mod f$, thì $Rot^d_f (a) = Rot^d_f (a')$ với mọi d. Cũng như $Rot_f (a\cdot b) = Rot_f (a)\cdot Rot_f (b)$ với mọi $a,b \in R[x]$. 


* Định nghĩa 3. Đặt f là ma trận bậc m. Chúng ta định nghĩa $M_f$ là ma trận (hankel- Ma trận Hankel là một ma trận vuông mà các phần tử trên các đường chéo phụ (từ dưới-trái lên trên-phải) là giống nhau) trong $R^{m\times m}$ sao cho với mọi $1\leq i,j\leq m$, hệ số $(M_f)_{i,j}$ là hệ số không đổi cả $x^{i+j-2}\mod f$.

Ma trận $M_f$ giúp viết lại phép nhân bên trái với ma trận $Rot_f(a)$  như phép nhân bên phải với a. 

Trực quan- Gọi $c_0(P)$ là hàm trích xuất hệ số tự do của một đa thức $P$. Ta có dạng tường minh của ma trận $M_f$ như sau:

$$ M_f = \begin{pmatrix} c_0(x^0 \bmod f) & c_0(x^1 \bmod f) & \cdots & c_0(x^{m-1} \bmod f) \\ c_0(x^1 \bmod f) & c_0(x^2 \bmod f) & \cdots & c_0(x^m \bmod f) \\ \vdots & \vdots & \ddots & \vdots \\ c_0(x^{m-1} \bmod f) & c_0(x^m \bmod f) & \cdots & c_0(x^{2m-2} \bmod f) \end{pmatrix} $$

:::info
Lemma 4. Với mọi $a\in R^{m}[x]$, chúng ta có $Rot_f(a)\cdot (1,0,\cdots,0)^T = M_f \cdot a$ 

Chứng minh: 
- Vế trái của phương trình là: $\text{LHS} = \text{Rot}_f(a) \cdot (1, 0, \dots, 0)^T$


$$ \text{LHS} = \begin{pmatrix} c_0(a) & \dots & \dots \\ c_0(x \cdot a \bmod f) & \dots & \dots \\ c_0(x^2 \cdot a \bmod f) & \dots & \dots \\ \vdots & \ddots & \vdots \\ c_0(x^{m-1} \cdot a \bmod f) & \dots & \dots \end{pmatrix} \begin{pmatrix} 1 \\ 0 \\ 0 \\ \vdots \\ 0 \end{pmatrix} = \begin{pmatrix} c_0(a) \\ c_0(x \cdot a \bmod f) \\ c_0(x^2 \cdot a \bmod f) \\ \vdots \\ c_0(x^{m-1} \cdot a \bmod f) \end{pmatrix} $$

Phần tử thứ $i$ (tính từ hàng $i=1$) của Vế Trái chính là hệ số tự do của đa thức $(x^{i-1} \cdot a \bmod f)$

- Vế phải của phương trình là tích của ma trận Hankel $M_f$ và vector cột $a$: $\text{RHS} = M_f \cdot a$.

$$ \text{RHS} = \begin{pmatrix} c_0(x^0) & c_0(x^1) & \cdots & c_0(x^{m-1}) \\ c_0(x^1) & c_0(x^2) & \cdots & c_0(x^m) \\ \vdots & \vdots & \ddots & \vdots \\ c_0(x^{i-1}) & c_0(x^i) & \cdots & c_0(x^{i+m-2}) \\ \vdots & \vdots & \ddots & \vdots \end{pmatrix} \begin{pmatrix} a_0 \\ a_1 \\ \vdots \\ \vdots \\ a_{m-1} \end{pmatrix} $$

Phần tử thứ i: 
\begin{aligned}
	i &=   a_0 \cdot c_0(x^{i-1}) + a_1 \cdot c_0(x^i) + a_2 \cdot c_0(x^{i+1}) + \dots + a_{m-1} \cdot c_0(x^{i+m-2}) \\
	&=   c_0\big( a_0 x^{i-1} + a_1 x^i + a_2 x^{i+1} + \dots + a_{m-1} x^{i+m-2} \big)  \\
	&=   c_0\Big( x^{i-1} \cdot (a_0 + a_1 x + a_2 x^2 + \dots + a_{m-1} x^{m-1}) \Big) \\
	&=  c_0(x^{i-1} \cdot a(x) \bmod f) 
\end{aligned}

Phần tử thứ $i$ của Vế Phải bằng chính xác phần tử thứ $i$ của Vế Trái. Điều phải chứng minh.
:::

:::success
Định nghĩa 5. Với mọi d,k>0 và  $a\in R^{m}[x]$, chúng ta đặt $Toep^{d,k}(a)$ ký hiệu ma trận trong  $R^{d\times (k+d-1)}[x]$ có hàng thứ i, với mọi $i=1,\cdots , d$, được cho với hệ số của $x^{i-1}\cdot a$.

Đa thức $a(x)$ thuộc $R_{<k}[x]$, tức là bậc tối đa của nó là k-1: 

$$a(x) = a_0 + a_1x + a_2x^2 + \dots + a_{k-1}x^{k-1}$$

Khi nhân $a(x)$ với $x^{i-1} | i \in \{1,\cdots ,d\}$, bậc lớn nhất khi i =d : 

$$x^{d-1} \cdot x^{k-1} = x^{k+d-2}$$

Một đa thức bậc $k+d-2$ sẽ có đúng $k+d-1$ hệ số (tính từ bậc 0). Đó là lý do tại sao ma trận này có số cột là $k+d-1$.

Công thức tổng quát $\text{Toep}_{d,k}(a)$: 

$$ \text{Toep}_{d,k}(a) = \begin{pmatrix} a_0 & a_1 & a_2 & \dots & a_{k-1} & 0 & \dots & 0 \\ 0 & a_0 & a_1 & \dots & a_{k-2} & a_{k-1} & \dots & 0 \\ 0 & 0 & a_0 & \dots & a_{k-3} & a_{k-2} & \dots & 0 \\ \vdots & \vdots & \ddots & \ddots & \ddots & \ddots & \ddots & \vdots \\ 0 & 0 & \dots & a_0 & a_1 & a_2 & \dots & a_{k-1} \end{pmatrix} $$

:::

:::info
Lemma 2.6. Với mọi d,k > 0 và mọi $a \in R^{<k}[x]$, chúng ta có $Rot^d_f(a) = Toep^{d,k}(a) \cdot Rot_f^{k+d-1}(1)$.

Ta gọi $r_j$ là một vector hàng chứa các hệ số của đa thức $x^j \mod f$. Ta có: 

$$ \text{LHS} = \text{Toep}_{d,k}(a) \times \text{Rot}(1) = \begin{pmatrix} a_0 & a_1 & a_2 & \cdots & a_{k-1} & 0 & \cdots & 0 \\ 0 & a_0 & a_1 & \cdots & a_{k-2} & a_{k-1} & \cdots & 0 \\ \vdots & \vdots & \vdots & \ddots & \vdots & \vdots & \ddots & \vdots \\ 0 & 0 & 0 & \cdots & a_0 & a_1 & \cdots & a_{k-1} \end{pmatrix} \times \begin{pmatrix} \leftarrow \mathbf{r}_0 \rightarrow \\ \leftarrow \mathbf{r}_1 \rightarrow \\ \leftarrow \mathbf{r}_2 \rightarrow \\ \vdots \\ \leftarrow \mathbf{r}_{k+d-2} \rightarrow \end{pmatrix} $$

Hàng 1 của LHS: 
$$ = a_0\mathbf{r}_0 + a_1\mathbf{r}_1 + a_2\mathbf{r}_2 + \dots + a_{k-1}\mathbf{r}_{k-1} $$

với $r_j = (x^j \mod f)$: 
$$ = a_0(1) + a_1(x) + a_2(x^2) + \dots + a_{k-1}(x^{k-1}) \pmod f $$

$$ = \mathbf{a(x) \pmod f} $$

Đúng Bằng hàng 1 của vế trái  $\text{Rot}^d_f(a)$. 

:::

:::success
Định nghĩa 2.7. Đặt $f \in \mathbb{Z}[x]$ bậc là m. Khi đó, expansion factor của f được định nghĩ là 
\begin{equation}
\mathrm{EF}(f)=
\max\!\left(
\frac{\|g \bmod f\|_{\infty}}
     {\|g\|_{\infty}}: g \in \mathbb{Z}^{<2m-1}[x]\setminus\{0\}
\right).
\end{equation}

Tức là tìm xem với mọi đa thức $g(x)$ có thể có, tỷ lệ phình to (trường hợp tệ nhất) này lớn nhất là bao nhiêu. Con số lớn nhất đó chính là Hệ số bùng nổ $EF(f)$.

Giả sử ta chọn một đa thức có hệ số lớn ở giữa: $f(x) = x^4 - 2x^3 + 1$.
Điều này có nghĩa là mỗi khi gặp $x^4$, ta được phép thay thế nó bằng: $x^4 = 2x^3 - 1$.
Nếu $g(x) = x^6$. Lúc này $\|g\|_\infty = 1$ (vì hệ số của $x^6$ là 1).
Bắt đầu gập các bậc cao xuống:
$x^4 = 2x^3 - 1$

$x^5 = x \cdot x^4 = x(2x^3 - 1) = 2x^4 - x = 2(2x^3 - 1) - x = 4x^3 - x - 2$

$x^6 = x \cdot x^5 = x(4x^3 - x - 2) = 4x^4 - x^2 - 2x = 4(2x^3 - 1) - x^2 - 2x = \mathbf{8x^3 - x^2 - 2x - 4}$

Sau khi rút gọn, ta được đa thức mới có $\|g \bmod f\|_\infty = |8| = 8$.

Tỷ lệ bùng nổ ở đây là $8 / 1 = \mathbf{8 \text{ lần}}$. 

Bậc càng cao, con số 2 kia càng nhân lên theo cấp số nhân ($2, 4, 8, 16\dots$). Lỗi trong mật mã sẽ bị khuếch đại lên và làm hỏng quá trình giải mã.


Chúng ta lưu ý rằng có rất nhiều đa thức có cận trên expasion factor. Một lớp đa thức như vậy là họ của tất các các đa thứ : $f = x^m + h$, với 
\begin{equation}
h=
\sum_{i\le m/2} h_i x^i,
\qquad
\|h\|_{\infty}\in \mathrm{poly}(m).
\end{equation}

thì ta có $EF(f)\in poly(m)$.

:::

:::info
Lemma 8. Cho $f\in \mathbb{Z}[x]$, chúng ta có $\|M_f\| \leq deg(f)\cdot EF(f)$.

Theo Định nghĩa 3, phần tử ở hàng $i$, cột $j$ của ma trận $M_f$ là:

$$ (M_f)_{i,j} = \text{Hệ số tự do của đa thức } (x^{i+j-2} \bmod f) $$

Ta có: 

$$ \|g \bmod f\|_\infty \leq \text{EF}(f) \cdot \|g\|_\infty $$

Ta lại có: $g(x) = x^{i+j-2}$: 

- Vì $1 \leq i, j \leq m$, bậc cao nhất của $g(x)$ là $2m-2$. Nó hoàn toàn thỏa mãn điều kiện nằm trong tập $\mathbb{Z}^{<2m-1}[x]$ của Định nghĩa 7.

- Hệ số lớn nhất của đa thức $g(x) = x^{i+j-2}$  là 1 (đi cùng $x$), còn lại là 0. Do đó, $\|g\|_\infty = 1$.

$$ \|x^{i+j-2} \bmod f\|_\infty \leq \text{EF}(f) \cdot 1 = \text{EF}(f) $$

Do đó : 

$$ |(M_f)_{i,j}| \leq \text{EF}(f) \quad \text{với mọi } i, j $$ 


Gọi $\|M_f\|_2$ là chuẩn phổ (giá trị kỳ dị lớn nhất) và $\|M_f\|_F$ là chuẩn Frobenius (căn bậc hai của tổng bình phương tất cả các phần tử). Ta có chuỗi bất đẳng thức sau:

1. Chuẩn phổ luôn nhỏ hơn hoặc bằng chuẩn Frobenius:

$$ \|M_f\|_2 \leq \|M_f\|_F $$

2. Công thức tính chuẩn Frobenius:

$$ \|M_f\|_F = \sqrt{\sum_{i=1}^m \sum_{j=1}^m |(M_f)_{i,j}|^2} $$

3. Thay giới hạn từ Bước 1 vào (mỗi phần tử đều $\leq \text{EF}(f)$). Ma trận có $m \times m = m^2$ phần tử:

$$ \|M_f\|_F \leq \sqrt{m^2 \cdot (\text{EF}(f))^2} = m \cdot \text{EF}(f) $$ 

Ta thu được: 

$$ \|M_f\|_2 \leq m \cdot \text{EF}(f) $$

hay: 

$$ \|M_f\| \leq \deg(f) \cdot \text{EF}(f) $$

:::


### The Polynomial Learning With Errors Problem (PLWE)

Trước tiên ta cần định nghĩa phân phối mà PLWE problem dựa trên. Từ đây đến hết blog, chúng ta sẽ sử dụng ký hiệu $\mathbb{R}_q:=\mathbb{R}/q\mathbb{Z}$

:::success
Định nghĩa 9. (Phân phối P). đặt $q\geq 2,m>0$, f đa thức bậc m, $\chi$ một phân phối trên $\mathbb{R}/f$. Cho $s\in \mathbb{Z}_q[x]/f$, chúng ta định nghĩa phân phối $P_{q,\chi}^{(f)}$ trên $\mathbb{Z}_q[x]/f\times \mathbb{R}_q[x]/f$ thu được thông qua cách lấy mẫu $a\leftarrow U(\mathbb{Z}_q[x]/f),e\leftarrow \chi$ và trả về $(a,b=a\cdot s + e)$.
:::

:::success
Định nghia 10. (PLWE). Cho $q\geq 2,m>0$, f một đa thức bậc m, $\chi$ một phân phối trên $\mathbb{R}/f$. (Decision) $PLWE_{q,\chi}^{(f)}$ bao gồm việc phân biệt giữa những mẫu tùy ý từ $P_{q,\chi}^{(f)}(s)$ và những mẫu giống nhau từ $U(\mathbb{Z}_q[x]/f\times \mathbb{R}_q[x]/f)$, với non-negligible probability trên các sự lựa chọn $s\leftarrow U(\mathbb{Z}_q[x]/f)$
:::

Cũng có thể định nghĩa một biến thể tìm kiếm của $PLWE_{q,\chi}^{(f)}$, điều này sẽ bao gồm việc tính toán $s\leftarrow \mathbb{Z}_q[x]/f$ từ những mẫu tùy ý được lấy từ $P_{q,\chi}^{(f)}(s)$.

## The Middle-Product Learning With Errors Problem

Ta cùng nhắc lại về định nghĩa middle product của 2 đa thức và các tính chất của nó. 

### The Middle-Product

Cho $R$ là một vành. Giả sử chúng ta nhân 2 đa thức $a$ và $b$ với bậc lần lượt là $<d_a,<d_b$. Giải sử rằng $d_a + d_b -1 = d+ 2 \cdot k$ với một vài số nguyên $d,k$. Thì middle product của d của a và b thu được từ nhân a và b, xóa phần hệ số (bên trái) của $1,x,\cdots , x^{k-1}$, xóa phần hệ số (bên phải) của $x^{k+d}, x^{k+d+1},\cdots ,x^{d+2\cdot k -1}$, và chia phần còn lại cho $x^k$.

:::success
Định nghĩa 1. Cho $d_a,d_b,d,k$ là các số nguyên sao cho $d_a + d_b -1 = d+ 2 \cdot k$. The middle product $\odot_d: R^{<d_a}[x] \times R^{<d_b}[x] \rightarrow R^{<d}[x]$ là ánh xạ: 

\begin{equation}
(a,b)
\mapsto
a \odot_{d} b=
\left[
\frac{
(a\cdot b)\bmod x^{k+d}
}{
x^{k}
}
\right].
\end{equation}

chúng ta sử dụng ký kiệu tương tự $\odot_d$ cho mọi $d_a, d_b $sao cho $d_a + d_b -1 -d$ là không âm và chẵn.
:::

Vectơ hệ số (đảo ngược) của tích giữa hai đa thức thực chất bằng tích của ma trận Toeplitz liên kết với đa thức thứ nhất với vectơ hệ số (đảo ngược) của đa thức thứ hai.

:::info
Lemma 2. cho d,k >0 . cho $r \in R^{k+1}[x]$ và $a\in R^{k+d}[x]$ và $b = r\odot_d a$. Khi đó $\overline{b}=\mathrm{Toep}^{\,d,k+1}(r)\cdot \overline{\mathbf{a}}$. Mặc khác, chúng ta có $b = \overline{Toep^{d,k+1}(r)\cdot \overline(a)}$.
:::


---
> To be continued


## References 
1. https://eprint.iacr.org/2017/628.pdf
