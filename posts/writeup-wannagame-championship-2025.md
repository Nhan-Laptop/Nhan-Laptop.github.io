# WannaGame ChampionShip 2025

> YEUEMTRANG |
> ---

> https://people.cs.nycu.edu.tw/~rjchen/ECC2012S/Elliptic%20Curves%20Number%20Theory%20And%20Cryptography%202n.pdf
> Cuốn sách trên gần như là công trình khá là vĩ đại nó giúp ích khá là nhiều.

## Tổng quan

Có một chall ở giải vừa qua về hình học không gian 4D mà mình thấy khá là hay - và mình mất 5 tiếng để debug và biến đổi......
![0QOAA](https://hackmd.io/_uploads/rJlz00SHZl.gif)

![M4gOo](https://hackmd.io/_uploads/SJIM0RBSZe.gif)

## Review

Trước khi vào challenge thì ta cần ôn lại một số kiến thức về hình học.
Ta sẽ trực quan dễ hiểu trên không gian 3D thay vì 4D khó hiểu.

### Hypherplane

> https://vi.wikipedia.org/wiki/Si%C3%AAu_ph%E1%BA%B3ng

Trong không gian 3D - (x,y,z), phương trình mặt phẳng đi qua gốc gọa độ là:

$$
a\cdot x + b\cdot y + c\cdot z = 0
$$

-> vector $\vec{L}= (a,b,c)$ là vector pháp tuyến của mặt, vuông góc với mặt phẳng.

Bât kỳ điểm $M(x,y,z)$ nào thuộc mặt phẳng đều phải thỏa phương trình trên và:

$$
L \cdot M = 0
$$

phép toán trên thực chất chỉ là một phép thay thế:

$$
\begin{aligned}
	\begin{bmatrix}
		a\ \ \ \
		b\ \ \ \
		c
	\end{bmatrix}
	\cdot \begin{bmatrix}
		x\\
		y\\
		z
	\end{bmatrix} = 0
\end{aligned}
$$

Siêu phẳng của không gian 3 chiều (n chiều) chính là một không gian con 2 (n-1 chiều) của nó:

![image](https://hackmd.io/_uploads/SyMB8yISZl.png)

Dễ dàng nhìn thấy nếu các phép tính được tính trên không gian 3D và thuộc siêu phẳng thì ta có thể hoàn toàn ánh xạ ngược về không gian 2 chiều để làm.

---

## CoCo - Clair

### Problem

```python
from sage.all import *
from Crypto.Util.number import bytes_to_long

class CO:
    def __init__(self, p: int, G: list[int], O: list[int]):
        assert is_prime(p)
        assert p.bit_length() == 256
        self.Fp = GF(p)
        self.G = [self.Fp(c) for c in G]
        self.O = [self.Fp(c) for c in O]
        assert self.is_on_curve(self.G)
        assert self.is_on_curve(self.O)

        self.L = self.random_element_from_basis(matrix(self.Fp, [self.G, self.O]).right_kernel_matrix())

    def random_element_from_basis(self, M):
        val = 0
        n = M.nrows()
        Fp = M.base_ring()
        for i in range(n):
            val += Fp.random_element() * M[i]
        return val

    def random_point(self):
        while True:
            a, b, c = [self.Fp.random_element() for _ in range(3)]
            x = self.Fp["d"].gen()
            f = a * b**2 + b * c**2 + c * x**2 + x * a**2
            r = f.roots()
            if len(r) > 0:
                d = r[0][0]
                assert self.is_on_curve([a, b, c, d])
                return [a, b, c, d]

    def is_on_curve(self, G: list):
        return G[0] * G[1]**2 + G[1] * G[2]**2 + G[2] * G[3]**2 + G[3] * G[0]**2 == 0

    def neg(self, P: list):
        if P == self.O:
            return P

        return self.intersect(P, self.O)

    def intersect(self, P: list, Q: list):
        aa = P[0] - Q[0]
        bb = P[1] - Q[1]
        cc = P[2] - Q[2]
        dd = P[3] - Q[3]
        A = aa * bb**2 + bb * cc**2 + cc * dd**2 + dd * aa**2
        C =   (P[1]**2 + 2 * P[0] * P[3]) * aa \
            + (P[2]**2 + 2 * P[0] * P[1]) * bb \
            + (P[3]**2 + 2 * P[1] * P[2]) * cc \
            + (P[0]**2 + 2 * P[2] * P[3]) * dd
        t = -C / A
        R = [0] * 4
        R[0] = P[0] + t * aa
        R[1] = P[1] + t * bb
        R[2] = P[2] + t * cc
        R[3] = P[3] + t * dd

        return R

    def add(self, P: list, Q: list):
        if P == self.O:
            return Q
        if Q == self.O:
            return P
        if P == self.neg(Q):
            return self.O
        R = self.intersect(P, Q)
        return self.neg(R)

    def double(self, P: list):
        Fa = 2 * P[0] * P[3] + P[1]**2
        Fb = 2 * P[0] * P[1] + P[2]**2
        Fc = 2 * P[1] * P[2] + P[3]**2
        Fd = 2 * P[2] * P[3] + P[0]**2
        vb = Matrix(self.Fp, [[Fa, Fb, Fc, Fd], self.L]).right_kernel_matrix()
        vx, vy, vz, vw = self.random_element_from_basis(vb)

        C3 = vx * vy**2 + vy * vz**2 + vz * vw**2 + vw * vx**2
        C2 =  P[0] * (2 * vw * vx + vy**2) \
            + P[1] * (2 * vx * vy + vz**2) \
            + P[2] * (2 * vy * vz + vw**2) \
            + P[3] * (2 * vw * vz + vx**2)
        t = -C2 / C3

        R = [0] * 4
        R[0] = P[0] + t * vx
        R[1] = P[1] + t * vy
        R[2] = P[2] + t * vz
        R[3] = P[3] + t * vw

        return self.neg(R)

    def scalarmult(self, k: int):
        assert k > 0
        R = None
        Q = self.G
        while k > 0:
            if k & 1:
                if R is None:
                    R = Q
                else:
                    R = self.add(R, Q)
            Q = self.double(Q)
            k >>= 1
        return R

flag = 'W1{' + 32*'?' + '}'
assert len(flag) == 36
assert flag[:3] == "W1{"
assert flag[-1] == "}"
flag = bytes_to_long(flag[3:-1].encode())

p = int(input("p = "))
G = [int(c) for c in input("G = ").split(",")]
O = [int(c) for c in input("O = ").split(",")]

curve = CO(p, G, O)
print(f"P = {curve.scalarmult(flag)}")
```

#### Mô tả:

Đại loại chall cho ta một sơ đồ mã hóa khá là phức tạp dựa trên quy tắc cộng điểm trong trường hữu hạn trên không gian 4 chiều:

- Generator: G(x1,x2,x3,x4) điểm sinh cho plane.
- Điểm vô cực - phần tử đơn vị: O(x1,x2,x3,x4).

#### Mặt bậc 3-S

Mặt bậc 3 - S được định nghĩa như sao:

$$
S : x_0 \cdot x_1^2 + x_1 \cdot x_2 ^ 2 + x_2 \cdot x_3 ^ 2 +  x_3 \cdot x_0 ^ 2  = 0
$$

#### Hyperplane L

Từ 2 điểm này ta sinh ra một siêu phẳng - [Hyperplane](https://en.wikipedia.org/wiki/Hyperplane) L trong không gian 4 chiều:

```go
self.L = self.random_element_from_basis(matrix(self.Fp, [self.G, self.O]).right_kernel_matrix())
```

> Tìm không gian hạt nhân (Kernel) vuông góc với cả ma trận $[G, O]$, sau đó lấy ngẫu nhiên một vector từ không gian này làm vector pháp tuyến ($L$)

#### Đường cong C = S ∩ L

Đường cong được dùng để tính toán chính là giao tuyến của mặt S và phẳng L:

$$
C = S ∩ L
$$

Đây là [Plane Cubic Curve](https://en.wikipedia.org/wiki/Cubic_plane_curve#Basics) ( đường cong bậc 3 phẳng )

Vì L là một siêu phẳng 3D nên ta có thể hoàn toàn ánh xạ về không gian 3D với 0xyz được định nghĩa từ L, Plane Cubic Curve:

![image](https://hackmd.io/_uploads/ryb5c1IrZl.png)

#### Phương pháp lấy giao - intersect

> https://math.stackexchange.com/questions/83990/line-and-plane-intersection-in-3d

```python
def intersect(self, P: list, Q: list):
        aa = P[0] - Q[0]
        bb = P[1] - Q[1]
        cc = P[2] - Q[2]
        dd = P[3] - Q[3]
        A = aa * bb**2 + bb * cc**2 + cc * dd**2 + dd * aa**2
        C =   (P[1]**2 + 2 * P[0] * P[3]) * aa \
            + (P[2]**2 + 2 * P[0] * P[1]) * bb \
            + (P[3]**2 + 2 * P[1] * P[2]) * cc \
            + (P[0]**2 + 2 * P[2] * P[3]) * dd
        t = -C / A
        R = [0] * 4
        R[0] = P[0] + t * aa
        R[1] = P[1] + t * bb
        R[2] = P[2] + t * cc
        R[3] = P[3] + t * dd

        return R
```

Đây chính là phương pháp tìm điểm giao giữa đường thẳng P, Q với mặt bậc 3:

- ảnh minh họa:
  ![image](https://hackmd.io/_uploads/ByJJke8rZx.png)

Đường thẳng: Ta tham số hóa đường thẳng đi qua P và Q bằng phương trình vector:

$$
L(t) = P + t \cdot (P-Q)
$$

- t = 0 : L(0) = P (điểm đầu).
- t = -1: L(-1) = Q (điểm thứ hai).
- t = ...: L(t) = P + Q

xây dựng vector chỉ phương của đường thẳng là:

$$
V = P - Q = (aa=P[0]-Q[0],bb=P[1]-Q[1],cc=P[2]-Q[2],dd=P[3]-Q[3])
$$

Phương tình S là: $S(x) = x_0 x_1^2 + x_1 x_2^2 + x_2 x_3^2 + x_3 x_0^2$.

Khi thay $L(t) = P + t \cdot V$ vào phương trình $S(L(t))=0$, ta sẽ thu được một phương trình bậc 3 theo ẩn t:

$$
A \cdot t^3 + B \cdot t^2 + C \cdot t + D = 0
$$

- $A = S(V)$ : hệ số của số hạng $t^3$ trong phương trình giao điểm.

Ta biết được P nằm trên mặt -> t1 = 0 là một nghiệm nên D = 0 -> Phương trình còn $At^3 + Bt^2 + Ct = 0$.

Tương tự với Q -> t2 = -1 là nghiệm thứ 2.

-> muốn tìm được R = P + Q thì ta buộc tìm được nghiệm thứ 3.

Theo định lý Vi-ét cho phương trình bậc 3 - $At^3 + Bt^2 + Ct = 0$:

$$
\begin{array}{c}
\left\{
\begin{aligned}
t_1 + t_2 + t_3 &= -\frac{B}{A} \\
t_1 t_2 + t_1 t_3 + t_2 t_3 &= \frac{C}{A} \\
t_1 t_2 t_3 &= -\frac{D}{A}
\end{aligned}
\right.
\end{array}
$$

với t1 = 0, t2 = -1 thì:

$$
t_3 = - \frac{C}{A}
$$

Tính C theo như scripts ( khai triển ra là biết ).

#### Phương pháp cộng điểm - Add

```python
def add(self, P: list, Q: list):
        if P == self.O:
            return Q
        if Q == self.O:
            return P
        if P == self.neg(Q):
            return self.O
        R = self.intersect(P, Q)
        return self.neg(R)
```

Phương pháp cộng điểm này cũng không có gì quá khó hiểu, chỉ là dựa trên:

![ee44171b-e4e2-400a-96dc-e84de7e0da77](https://hackmd.io/_uploads/H17g2lUSWe.gif)

#### Phép cộng 2 điểm giống nhau - nhân đôi

```py
def double(self, P: list):
        Fa = 2 * P[0] * P[3] + P[1]**2
        Fb = 2 * P[0] * P[1] + P[2]**2
        Fc = 2 * P[1] * P[2] + P[3]**2
        Fd = 2 * P[2] * P[3] + P[0]**2
        vb = Matrix(self.Fp, [[Fa, Fb, Fc, Fd], self.L]).right_kernel_matrix()
        vx, vy, vz, vw = self.random_element_from_basis(vb)

        C3 = vx * vy**2 + vy * vz**2 + vz * vw**2 + vw * vx**2
        C2 =  P[0] * (2 * vw * vx + vy**2) \
            + P[1] * (2 * vx * vy + vz**2) \
            + P[2] * (2 * vy * vz + vw**2) \
            + P[3] * (2 * vw * vz + vx**2)
        t = -C2 / C3

        R = [0] * 4
        R[0] = P[0] + t * vx
        R[1] = P[1] + t * vy
        R[2] = P[2] + t * vz
        R[3] = P[3] + t * vw

        return self.neg(R)
```

tương tự với phép công thông thường.

![image](https://hackmd.io/_uploads/rybvnlLB-e.png)

#### Phép nhân vô hướng

```python
def scalarmult(self, k: int):
        assert k > 0
        R = None
        Q = self.G
        while k > 0:
            if k & 1:
                if R is None:
                    R = Q
                else:
                    R = self.add(R, Q)
            Q = self.double(Q)
            k >>= 1
        return R
```

Bản chất về toán học, một số nguyên dương k được biểu diễn như sau:

$$
k = b_0 \cdot 2^0 + b_1 \cdot 2^1 + b_2 \cdot 2^2 + \dots + b_n \cdot 2^n
$$

- $b\in \{0,1\}$

nên ta hoàn toàn có thể tính phép nhân $k*G$:

$$
k \cdot G = (b_0 \cdot 2^0 + b_1 \cdot 2^1 + \dots + b_n \cdot 2^n) \cdot G
$$

$$
k \cdot G = b_0(G) + b_1(2G) + b_2(4G) + \dots + b_n(2^n G)
$$

Làm vậy thì sẽ đỡ tốn phép tính hơn.

#### Bài toán cần giải ???

```py
flag = 'W1{' + 32*'?' + '}'
assert len(flag) == 36
assert flag[:3] == "W1{"
assert flag[-1] == "}"
flag = bytes_to_long(flag[3:-1].encode())

p = int(input("p = "))
G = [int(c) for c in input("G = ").split(",")]
O = [int(c) for c in input("O = ").split(",")]

curve = CO(p, G, O)
print(f"P = {curve.scalarmult(flag)}")
```

Ta kiểm soát được G và O và cần tìm lại giá trị flag thông qua bài toán CODLP ( mình định nghĩa tìm logarit rời rạc trên CO ).

### Solve

Nãy giờ như chúng ta đang phân tích thì các phép toán cộng điểm được làm trên một "ECC" và nhiệm vụ của ta cần tìm order của nhóm để DLP.

#### Tìm lại L và giảm chiều 4D -> 3D

với 2 điểm thì ta có vô số Hyperplane nhưng vì server luôn trả ta điểm $P = flag * G$ thì ta luôn tìm lại được $L$:

```go
Fp = GF(p)

M = Matrix(Fp, [G, O, P])
Ker = M.right_kernel()
if Ker.dimension() != 1:
	return None
L = Ker.basis()[0]
```

Như đã phân tích thì siêu phẳng L có không gian chiều là 3, nên ta có thể hạ chiều từ 4 -> 3 làm việc trong không gian 3 chiều L:
![image](https://hackmd.io/_uploads/S13qwQUrbl.png)

- Tìm cơ sở $u,v,w$ của L.
- Biểu diễn các tạo độ thông qua 3 vector: $\vec{u},\vec{v},\vec{w}$ (3 vector cơ sở trong không gian 3 chiều - L) và 3 hệ số $X,Y,Z$, với một điểm P = (x1,x2,x3,x4) ta có: .

$$
\mathbf{P} = X \cdot \vec{u} + Y \cdot \vec{v} + Z \cdot \vec{w}
$$

hơi khó hiểu vì sao lại thế nhưng đại loại là với hệ số khác nhau ta sẽ tạo thành một điểm từ 3 vector trên:

$$
\begin{cases}
x_0 = X \cdot u_0 + Y \cdot v_0 + Z \cdot w_0 \\
x_1 = X \cdot u_1 + Y \cdot v_1 + Z \cdot w_1 \\
x_2 = X \cdot u_2 + Y \cdot v_2 + Z \cdot w_2 \\
x_3 = X \cdot u_3 + Y \cdot v_3 + Z \cdot w_3
\end{cases}
$$

Ta chuẩn hóa từ 4D (x0,x1,x2,x3) -> 3D (X,Y,Z).

```go
Plane_Basis = Matrix(L).right_kernel().basis()

u, v, w = Plane_Basis
R = PolynomialRing(Fp, 'X,Y,Z')
X, Y, Z = R.gens()

subs_map = [X*u[i] + Y*v[i] + Z*w[i] for i in range(4)]
x0, x1, x2, x3 = subs_map
cubic_eq = x0*x1**2 + x1*x2**2 + x2*x3**2 + x3*x0**2
```

#### Chuẩn hóa tọa độ

> https://people.tamu.edu/~rojas//cubic2weierstrass.pdf

Ta cần chuẩn hóa tạo độ O về chuẩn tọa độ trong hình học xạ ảnh là (0,1,0).

Trước đó, ta đã tìm được 3 vector cơ sở tạo nên không gian 3D (siêu phẳng L). Điểm O là một điểm trong không gian 4D (x1,x2,x3,x4) nhưng nó nằm trên mặt phẳng này.

Để làm việc trên không gian 3D, ta cần biểu diễn O dưới dạng tổ hợp tuyến tính của 3 vector cơ sở:

$$
O = X \cdot \vec{u} + Y \cdot \vec{v} + Z \cdot \vec{w}
$$

Ta tìm như sau:

$$
\begin{aligned}
\begin{bmatrix}
| & | & | \\
\vec{u} & \vec{v} & \vec{w} \\
| & | & |
\end{bmatrix}
\cdot
\begin{bmatrix}
X \\
Y \\
Z
\end{bmatrix} =
\begin{bmatrix}
| \\
O \\
|
\end{bmatrix}
\end{aligned}
$$

```go
Basis_Mat = Matrix(Fp, Plane_Basis).transpose()
O_proj = list(Basis_Mat.solve_right(vector(Fp, O)))
```

Bây giờ ta cần chuẩn hóa O:

- Mục tiêu ta cần tạo ra hệ tọa độ mới $(X_{new}, Y_{new}, Z_{new})$ sao cho điểm O có tọa độ là $(0, 1, 0)$.

Ta gọi tọa độ trong hệ cũ là vector $\vec{x}_{old}$ (chính là $O_{proj}$) và tọa độ trong hệ mới là $\vec{x}_{new}$.

Mối quan hệ giữa chúng được biểu diễn qua ma trận biến đổi $M1$ - hay là một phép đổi trục là:

$$
\mathbf{x}_{old} = M1 \cdot \mathbf{x}_{new}
$$

- Mục tiêu: Ta muốn khi $\mathbf{x}_{new} = (0, 1, 0)^T$ (điểm chuẩn), thì nó phải tương ứng với $\mathbf{x}_{old} = O_{proj}$ (điểm thực tế)

Thay vào công thức trên:

$$
O_{proj} =
\begin{bmatrix}
C_0 & C_1 & C_2
\end{bmatrix}
\cdot
\begin{bmatrix}
0 \\
1 \\
0
\end{bmatrix}
$$

$$
O_{proj} = 0 \cdot C_0 + 1 \cdot C_1 + 0 \cdot C_2 = C_1
$$

-> Cột thứ 2 (Cột giữa) của ma trận $M1$ bắt buộc phải là vector O_proj.

Để ma trận $M1$ khả nghịch (tạo thành hệ trục tọa độ hợp lệ), ta cần chọn 2 cột còn lại ($C_0, C_2$) sao cho chúng độc lập tuyến tính với $C_1$. Cách đơn giản nhất là chọn các vector đơn vị chuẩn:

$$
M1 =
\begin{bmatrix}
1 & \mathbf{X}_{new} & 0 \\
0 & \mathbf{Y}_{new} & 0 \\
0 & \mathbf{Z}_{new} & 1
\end{bmatrix}
$$

```go
M1 = Matrix(Fp, 3, 3)
M1.set_column(1, vector(Fp, O_proj))
std = [vector(Fp, d) for d in [[1,0,0], [0,1,0], [0,0,1]]]
M1.set_column(0, std[0])
M1.set_column(2, std[2])
```

Tiếp theo sau ta cần biến đổi từ cubic_eq_old -> cubic_eq_new với x_new như sau:

```go
def apply_transform(poly, Mat):
	X_old = Mat * vector(R, [X,Y,Z])
	return poly(X_old[0], X_old[1], X_old[2])

F1 = apply_transform(cubic_eq, M1)
```

#### Chuyển đổi phương trình bậc 3 tổng quát sang dạng Weierstrass (Thông qua đa thức bậc 4).

> blog này là thứ mà chúng ta cần quan tâm https://ctnt-summer.math.uconn.edu/wp-content/uploads/sites/1632/2016/02/Matsuura-projective_transformation.pdf
> https://ctnt-summer.math.uconn.edu/wp-content/uploads/sites/1632/2016/02/Matsuura-projective_transformation.pdf
> https://math.stackexchange.com/questions/4517572/finding-lattice-points-on-a-cubic
> https://web.archive.org/web/20231117160409/http://webs.ucm.es/BUCM/mat/doc8354.pdf
> https://people.tamu.edu/~rojas//cubic2weierstrass.pdf
> https://www.pdmi.ras.ru/~lowdimma/BSD/Silverman-Arithmetic_of_EC.pdf
> https://www.arxiv.org/pdf/1006.1002v3#:~:text=Note%20that%20in%20each%20of,(I%2CJ)%20varies

Khi đổi được trục ta có F1-cubic_eq_new là:

$$
F(X,Y,Z) = a*X^3 + b*X^2*Y + (c*X +f*Z)*Y^2 + d*X^2*Z + e*X*Y*Z + g*X*Z^2 + h*Y*Z^2 + k*Z^3 = 0
$$

Có một hàm để chuyển nhưng mà :
![image](https://hackmd.io/_uploads/B1PrOdLSWe.png)
chịu luôn

Ta cầm đưa về phương trình dạng Weierstrass:

$$
Y^2Z + a_1X\cdot Y\cdot Z + a_3Y\cdot Z^2 = X^3 + a_2\cdot X^2\cdot Z + a_4\cdot X\cdot Z^2 + a_6\cdot Z^3
$$

> trong Weierstrass thì x và y^2 không đi chung với nhau. Câu hỏi đặt ra là tại sao mình không chuyển 1 phát 1 từ (c * X +f * Z) =1 cho rồi, e là không thể ???

Ta có:

$$
\begin{array}{c}
Z_{new}\leftarrow c*X +f*Z \\
\downarrow\\
Z =   \frac{1}{f}*Z_{mới} - \frac{c}{f}*X\\
\downarrow \\
Z_{new}\leftarrow c*X +f * (\frac{1}{f}*Z_{mới} - \frac{c}{f}*X) \\
\downarrow \\
Z_{new}\leftarrow c*X +Z_{mới} - c*X
\end{array}
$$

```go
cx = F1.monomial_coefficient(X*Y**2)
cz = F1.monomial_coefficient(Z*Y**2)

inv_cz = cz**-1
F2 = F1(X, Y, inv_cz*Z - (cx*inv_cz)*X)
```

kết quả là:

$$
F(X,Y,Z) = a*X^3 + b*X^2*Y + c*X^2*Z + d*X*Y*Z + Y^2*Z + e*X*Z^2 + f*Y*Z^2 + g*Z^3
$$

Bây giờ ta cần chiếu từ không gian 3D (Projective) sang 2D (Affine) để đưa về dạng Weierstrass $y^2 = x^3 + ax + b$.

Hạ chiều:

Ta đặt $Z_{new} = 1$ lúc này phương trình trở về dạng đa thức 2 biến x,y:

$$
y^2 + (\text{đa thức của } x) \cdot y + (\text{đa thức của } x) = 0
$$

Sau đó, ta gom nhóm thành phương trình bậc 2 theo y:

$$
A \cdot y^2 + B(x) \cdot y + C(x) = 0 = f(x,y)
$$

Chú thích:

- A = 1 ( vì $Z =1 = A$ )
- B(x)= f(x,1)
- C(x)= f(x,0)

Giờ giải tí phương trình:

$$
\begin{aligned}
y^2 + B(x) \cdot y + C(x) &= 0 \\
\Leftrightarrow y^2 + B(x) \cdot y   &= - C(x) \\
\Leftrightarrow y^2 + B(x) \cdot y + \left(\frac{B(x)}{2}\right)^2 &= - C(x) + \left(\frac{B(x)}{2}\right)^2 \\
\Leftrightarrow \left( y + \frac{B(x)}{2} \right)^2 &= \frac{B(x)^2}{4} - C(x)\\
\Rightarrow \left( y + \frac{B}{2} \right)^2 &= \frac{B^2}{4} - C\ (\text{Đặt B = B(x), C = C(X)})\\
\Leftrightarrow 4 \cdot \left( y + \frac{B}{2} \right)^2 &= 4 \cdot \left( \frac{B^2}{4} - C \right) \\
\Leftrightarrow \left( 2\cdot y + B \right)^2 &= B^2 - 4\cdot C\\
\downarrow\\
y^2 = \left( B(x) \right ) ^2 &- 4 \cdot C(X)
\end{aligned}
$$

Tạo sao phương trình cuối mình lại bỏ đi B(X) vế trái: Đơn giản là vì nó chỉ là phép dịch tọa độ, nên mình bỏ cũng được.

Vì B(x) là bậc 2, C(x) là bậc 3 nên ta có được một Quartic như sau:

$$
y^2 = A * x^4 + B * x^3 + C * x^2 + D * x + E
$$

Từ đây ta tính được i (Quadratic Invariant), j (Cubic Invariant):

![image](https://hackmd.io/_uploads/ryR1UqIBZl.png)

Và tìm lại j-invarient:

Đường cong Elliptic - Weierstrass tương ứng là:

$$
y^2 = x^3 - 27 \cdot I \cdot x - 27 \cdot J
$$

Phần này mình tìm các curve có j-invarint như thế rồi mình kiểm tra xem có curve nào hợp lí từ các curve sinh ra:

$$
j(E) = 1728 \frac{4I^3}{4I^3 - J^2}
$$

```go
def get_quartic_invariants(A, B, C, D, E, p):
    I = (12*A*E - 3*B*D + C**2) % p
    J = (72*A*C*E + 9*B*C*D - 27*A*D**2 - 27*E*B**2 - 2*C**3) % p
    return I, J

f_aff = F2.subs({Z:1})
Q_poly = f_aff.coefficient({Y:1}) // B(x)
C_poly = f_aff.coefficient({Y:0}) // C(x)
c_const = Fp(f_aff.coefficient({Y:2}))//Delta

R_uni = PolynomialRing(Fp, 'x')
x_uni = R_uni.gen()
Q_uni = Q_poly.subs({Y:0, X:x_uni})
C_uni = C_poly.subs({Y:0, X:x_uni})

Quartic = Q_uni**2 - 4 * c_const * C_uni
coeffs = Quartic.coefficients(sparse=False)
coeffs += [0]*(5-len(coeffs))
E_c, D_c, C_c, B_c, A_c = coeffs[:5]

I, J_inv_param = get_quartic_invariants(A_c, B_c, C_c, D_c, E_c, p)

num = 1728 * 4 * I**3
den = 4 * I**3 - J_inv_param**2
if den == 0: return None
j_val = Fp(num) / Fp(den)

try:
	E_base = EllipticCurve_from_j(j_val)
except:
	return None

checker = CO(p, G, O)
checker.L = L

for E_cand in E_base.twists():
	try:
		cand_N = E_cand.order()
		if checker.scalarmult(cand_N) == checker.O:
			return cand_N, list(L)
	except:
		pass
```

Tới đây xong mình có Order rồi thì mình sẽ giải subgroup để có được Flag_partial

#### Find flag

Có 1 điều đặc biệt là mình không hiểu sao mình imple Baby-step giant-step không được, nên mình brute số nhỏ luôn rồi ghép lại bằng crt :)).
Giải DLP thông qua subgroup- Pohlig-Hellman.

> Chú ý vì khi nhân đôi điểm có sử dụng random nên mình chuẩn hóa lại cho chuẩn.

```go
def normalize(P):
    P = list(P)
    inv = None
    for val in reversed(P):
        if val != 0:
            inv = val**-1
            break
    if inv is None: return tuple([0]*4)
    return tuple([val * inv for val in P])

def scalarmult_custom(self, P, k):
    R = None; Q = P
    while k > 0:
        if k & 1: R = Q if R is None else self.add(R, Q)
        Q = self.double(Q); k >>= 1
    return R
CO_Simulation.scalarmult_custom = scalarmult_custom

def attack():
    residues = []
    moduli = []

    while LCM(moduli) < 2**288:
        p = next_prime(2**255 + 1337)
        F = GF(p)
        while True:
            r = remote('challenge.cnsc.com.vn', 31749)
            # r = process(['python3', 'chall.py'],level = 'debug')
            current_lcm = LCM(moduli)

            r.sendline(str(p).encode())
            def gen_pt():
                while True:
                    a,b,c = [F.random_element() for _ in range(3)]
                    if c==0: continue
                    R = F['x']; val = a*b**2 + b*c**2
                    poly = c*R.gen()**2 + a**2*R.gen() + val
                    roots = poly.roots()
                    if roots: return [a,b,c, roots[0][0]]

            G = gen_pt(); O = gen_pt()
            r.sendline(','.join(str(x) for x in G).encode())
            r.sendline(','.join(str(x) for x in O).encode())
            sim = CO_Simulation(p, G, O)
            r.recvuntil('P = ')
            resp = r.recvline().decode().strip()
            P_val  = eval(resp)

            result = recover_curve_order_robust(p, G, O, P_val)
            if result:
                order, checker, curve_obj = result
                limit = 2**16

                try:
                    iter_factors = factor(order, limit=limit)
                except: continue

                useful_factors = []
                for pp, ee in iter_factors:
                    if pp > limit: continue
                    q = pp ** ee

                    if q in moduli: continue
                    if any(gcd(q, m) > 1 for m in moduli): continue

                    useful_factors.append(q)

                if not useful_factors:
                    continue

                print(f"[+] Found useful factors on curve: {useful_factors}")

                found_new = False
                for q in useful_factors:
                    if q > 2**15:
                        print(f"    [.] Skipping large factor {q} for efficiency.")
                        continue
                    cofactor = order // q

                    G_sub = checker.scalarmult_custom(G, cofactor)
                    P_sub = checker.scalarmult_custom(P_val, cofactor)

                    if normalize(G_sub) == normalize(checker.O):
                        continue

                    for c in range(1, cofactor):
                        tmp = checker.scalarmult_custom(G_sub, c)
                        tmp = list(tmp)
                        tmp = normalize(tmp)
                        if tmp == normalize(P_sub):
                            print(f"[+] Verified locally: x = {c} mod {q}")
                            print()
                            residues.append(c%q)
                            moduli.append(q)
                            print(long_to_bytes(int(crt(residues, moduli))))
                            found_new = True
                            break


                if found_new:
                    break

            r.close()


if __name__ == "__main__":
    attack()
```

## Script

<details>
<summary>Bấm để xem chi tiết Script / Code</summary>

```go
from pwn import *

from sage.all import *

from Crypto.Util.number import *
import sys

class CO_Simulation:
    def __init__(self, p, G, O):
        self.Fp = GF(p); self.G = [self.Fp(c) for c in G]; self.O = [self.Fp(c) for c in O]
        M = matrix(self.Fp, [self.G, self.O])
        self.L = self.random_element_from_basis(M.right_kernel_matrix())

    def random_element_from_basis(self, M):
        val = 0; n = M.nrows(); Fp = M.base_ring()
        for i in range(n): val += Fp.random_element() * M[i]
        return val

    def is_same_point(self, P, Q):
        return normalize(P) == normalize(Q)

    def is_on_curve(self, G): return G[0]*G[1]**2 + G[1]*G[2]**2 + G[2]*G[3]**2 + G[3]*G[0]**2 == 0

    def intersect(self, P, Q):
        aa, bb, cc, dd = P[0]-Q[0], P[1]-Q[1], P[2]-Q[2], P[3]-Q[3]
        A = aa*bb**2 + bb*cc**2 + cc*dd**2 + dd*aa**2
        C = (P[1]**2 + 2*P[0]*P[3])*aa + (P[2]**2 + 2*P[0]*P[1])*bb + (P[3]**2 + 2*P[1]*P[2])*cc + (P[0]**2 + 2*P[2]*P[3])*dd

        if A == 0:
            return self.O

        t = -C/A; return [P[0]+t*aa, P[1]+t*bb, P[2]+t*cc, P[3]+t*dd]

    def neg(self, P): return P if P==self.O else self.intersect(P, self.O)

    def double(self, P):
        Fa, Fb, Fc, Fd = 2*P[0]*P[3]+P[1]**2, 2*P[0]*P[1]+P[2]**2, 2*P[1]*P[2]+P[3]**2, 2*P[2]*P[3]+P[0]**2
        vb = Matrix(self.Fp, [[Fa, Fb, Fc, Fd], self.L]).right_kernel_matrix()
        vx, vy, vz, vw = self.random_element_from_basis(vb)
        C3 = vx*vy**2 + vy*vz**2 + vz*vw**2 + vw*vx**2
        C2 = P[0]*(2*vw*vx+vy**2) + P[1]*(2*vx*vy+vz**2) + P[2]*(2*vy*vz+vw**2) + P[3]*(2*vw*vz+vx**2)
        t = -C2/C3; R = [P[0]+t*vx, P[1]+t*vy, P[2]+t*vz, P[3]+t*vw]
        return self.neg(R)

    def add(self, P, Q):
        if P == self.O: return Q
        if Q == self.O: return P

        if self.is_same_point(P, Q):
            return self.double(P)


        return self.neg(self.intersect(P, Q))

    def scalarmult(self, k):
        R = None; Q = self.G
        while k > 0:
            if k & 1: R = Q if R is None else self.add(R, Q)
            Q = self.double(Q); k >>= 1
        return R



def get_quartic_invariants(A, B, C, D, E, p):
    I = (12*A*E - 3*B*D + C**2) % p
    J = (72*A*C*E + 9*B*C*D - 27*A*D**2 - 27*E*B**2 - 2*C**3) % p
    return I, J

def recover_curve_order_robust(p, G, O, P):
    Fp = GF(p)
    try:
        M = Matrix(Fp, [G, O, P])
        Ker = M.right_kernel()
        if Ker.dimension() != 1: return None
        L = Ker.basis()[0]

        Plane_Basis = Matrix(L).right_kernel().basis()
        u, v, w = Plane_Basis
        R = PolynomialRing(Fp, 'X,Y,Z')
        X, Y, Z = R.gens()

        subs_map = [X*u[i] + Y*v[i] + Z*w[i] for i in range(4)]
        x0, x1, x2, x3 = subs_map
        cubic_eq = x0*x1**2 + x1*x2**2 + x2*x3**2 + x3*x0**2

        Basis_Mat = Matrix(Fp, Plane_Basis).transpose()
        O_proj = list(Basis_Mat.solve_right(vector(Fp, O)))

        M1 = Matrix(Fp, 3, 3)
        M1.set_column(1, vector(Fp, O_proj))
        std = [vector(Fp, d) for d in [[1,0,0], [0,1,0], [0,0,1]]]
        M1.set_column(0, std[0]); M1.set_column(2, std[2])

        def apply_transform(poly, Mat):
            new_vars = Mat * vector(R, [X,Y,Z])
            return poly(new_vars[0], new_vars[1], new_vars[2])

        F1 = apply_transform(cubic_eq, M1)

        cx = F1.monomial_coefficient(X*Y**2)
        cz = F1.monomial_coefficient(Z*Y**2)
        if cx == 0 and cz == 0: return None

        inv_cz = cz**-1
        F2 = F1(X, Y, inv_cz*Z - (cx*inv_cz)*X)

        c_y2z = F2.monomial_coefficient(Y**2 * Z)
        if c_y2z == 0: return None

        f_aff = F2.subs({Z:1})
        Q_poly = f_aff.coefficient({Y:1})
        C_poly = f_aff.coefficient({Y:0})
        c_const = Fp(f_aff.coefficient({Y:2}))

        R_uni = PolynomialRing(Fp, 'x')
        x_uni = R_uni.gen()
        Q_uni = Q_poly.subs({Y:0, X:x_uni})
        C_uni = C_poly.subs({Y:0, X:x_uni})

        Quartic = Q_uni**2 - 4 * c_const * C_uni
        coeffs = Quartic.coefficients(sparse=False)
        coeffs += [0]*(5-len(coeffs))
        E_c, D_c, C_c, B_c, A_c = coeffs[:5]

        I, J_inv_param = get_quartic_invariants(A_c, B_c, C_c, D_c, E_c, p)

        num = 1728 * 4 * I**3
        den = 4 * I**3 - J_inv_param**2
        if den == 0: return None
        j_val = Fp(num) / Fp(den)

        try: E_base = EllipticCurve_from_j(j_val)
        except: return None

        checker = CO_Simulation(p, G, O)
        checker.L = L

        for E_cand in E_base.twists():
            try:
                cand_N = E_cand.order()
                if checker.scalarmult(cand_N) == checker.O:
                    return cand_N, checker, E_cand
            except: pass

    except Exception as e:
        return None
    return None


def normalize(P):
    P = list(P)
    inv = None
    for val in reversed(P):
        if val != 0:
            inv = val**-1
            break
    if inv is None: return tuple([0]*4)
    return tuple([val * inv for val in P])

def scalarmult_custom(self, P, k):
    R = None; Q = P
    while k > 0:
        if k & 1: R = Q if R is None else self.add(R, Q)
        Q = self.double(Q); k >>= 1
    return R
CO_Simulation.scalarmult_custom = scalarmult_custom

def attack():
    residues = []
    moduli = []

    while LCM(moduli) < 2**288:
        p = next_prime(2**255 + 1337)
        F = GF(p)
        while True:
            r = remote('challenge.cnsc.com.vn', 31749)
            # r = process(['python3', 'chall.py'],level = 'debug')
            current_lcm = LCM(moduli)

            r.sendline(str(p).encode())
            def gen_pt():
                while True:
                    a,b,c = [F.random_element() for _ in range(3)]
                    if c==0: continue
                    R = F['x']; val = a*b**2 + b*c**2
                    poly = c*R.gen()**2 + a**2*R.gen() + val
                    roots = poly.roots()
                    if roots: return [a,b,c, roots[0][0]]

            G = gen_pt(); O = gen_pt()
            r.sendline(','.join(str(x) for x in G).encode())
            r.sendline(','.join(str(x) for x in O).encode())
            sim = CO_Simulation(p, G, O)
            r.recvuntil('P = ')
            resp = r.recvline().decode().strip()
            P_val  = eval(resp)

            result = recover_curve_order_robust(p, G, O, P_val)
            if result:
                order, checker, curve_obj = result
                limit = 2**16

                try:
                    iter_factors = factor(order, limit=limit)
                except: continue

                useful_factors = []
                for pp, ee in iter_factors:
                    if pp > limit: continue
                    q = pp ** ee

                    if q in moduli: continue
                    if any(gcd(q, m) > 1 for m in moduli): continue

                    useful_factors.append(q)

                if not useful_factors:
                    continue

                print(f"[+] Found useful factors on curve: {useful_factors}")

                found_new = False
                for q in useful_factors:
                    if q > 2**15:
                        print(f"    [.] Skipping large factor {q} for efficiency.")
                        continue
                    cofactor = order // q

                    G_sub = checker.scalarmult_custom(G, cofactor)
                    P_sub = checker.scalarmult_custom(P_val, cofactor)

                    if normalize(G_sub) == normalize(checker.O):
                        continue

                    for c in range(1, cofactor):
                        tmp = checker.scalarmult_custom(G_sub, c)
                        tmp = list(tmp)
                        tmp = normalize(tmp)
                        if tmp == normalize(P_sub):
                            print(f"[+] Verified locally: x = {c} mod {q}")
                            print()
                            residues.append(c%q)
                            moduli.append(q)
                            print(long_to_bytes(int(crt(residues, moduli))))
                            found_new = True
                            break


                if found_new:
                    break

            r.close()


if __name__ == "__main__":
    attack()
```

</details>

## References

Hmm từng phần mình có để các đường link rồi nhé!
