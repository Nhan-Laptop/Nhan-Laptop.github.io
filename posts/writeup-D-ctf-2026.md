---
date: 2026-09-19
summary: .
tags:
  - crypto
  - cvp
  - sage
  - lll_cvp
  - kannan_cvp
---

# Power with Errors

> Nhan_laptop |
>
> ---

## Motivation

Bài này có một chỗ  khá là hay: nhìn vào source thì thấy lũy thừa ma trận với số mũ ngẫu nhiên, nhưng thứ mình cần tìm lại không phải ma trận gốc hay số mũ. Ta chỉ cần lấy được phần nhiễu được cộng vào từng phần tử là đủ để giải mã flag.

Vậy bỏ qua số mũ bằng cách nào?

Để ý rằng **hai lũy thừa của cùng một ma trận luôn giao hoán**. Khi thêm nhiễu, quan hệ này không mất hoàn toàn mà biến thành một hệ phương trình có phần tuyến tính và một phần bậc hai rất nhỏ. Từ đây mình đưa về lattice.

## Đề bài

Tham số được cho:

```python
p = 289681150111530694174556323703782825681
n = 10
t = 5
c = 3
```

Trong đó `p` là số nguyên tố 128 bit. Đoạn chính của challenge:

```python

def xor(A, B):
    return bytes([a^^b for (a, b) in zip(A, B)])

flag = open("flag.txt", "rb").read()
assert len(flag) <= n*n
flag += b"\x00" * (n*n - len(flag))

for T in range(t):
    A = random_matrix(GF(p), n, n)
    out = []
    for _ in range(c):
        key = b"\x00" + os.urandom(n*n - 1)
        print(list(key))
        flag = xor(key, flag)
        U = pow(A, secrets.randbelow(p)).list()
        U = [a+b for (a, b) in zip(U, key)]
        out.append(U)
    F = open(f"testcase_{T}.in", "w")
    F.write(f"{out}")
    F.close()

F = open("enc", "wb")
F.write(flag)
F.close()
```

Đại loại ở mỗi testcase, challenge sinh một ma trận $A\in M_{10}(\mathbb F_p)$, sau đó dùng lại chính ma trận này để tạo 3 output:

$$
B_i=A^{r_i}+E_i,\qquad i\in\{0,1,2\}.
$$

Ở đây:

- $r_i$ là số mũ ngẫu nhiên, không được công khai.
- $E_i$ là ma trận tạo từ 100 byte của `key`, xếp theo từng hàng giống `.list()` của Sage.
- Mỗi phần tử của $E_i$ nằm trong $[0,255]$, riêng $(E_i)_{0,0}=0$.
- Phép cộng vào output diễn ra trong $\mathbb F_p$, vì các phần tử của `U` vẫn là phần tử trường hữu hạn.

Các đẳng thức ma trận dưới đây được xét trong $\mathbb F_p$, trừ những chỗ mình chuyển sang số nguyên để chặn nhiễu hoặc dựng lattice.

Chú ý rằng `A` chỉ được dùng chung trong một testcase. Sang testcase tiếp theo thì challenge sinh `A` mới, nên ta sẽ xử lý từng nhóm 3 ma trận riêng biệt.

Flag được padding bằng byte `0` đến 100 byte, sau đó XOR lần lượt với cả $5\cdot3=15$ key. Không có bước reset flag giữa các testcase.

> Source có `print(list(key))`, nhưng bộ file đính kèm không có bản ghi stdout chứa các key này. Vì vậy hướng giải dưới đây chỉ dùng `params`, các testcase và `enc`.

## hmmm

bài MRSA — HITCON 2025 của Connor. Bài đó dùng nhận xét C = Mᵉ nên MC = CM, rồi tận dụng việc các phần tử của M là byte để dựng lattice. Ở bài này, hai output đều bị cộng nhiễu nên quan hệ giao hoán không còn tuyến tính hoàn toàn: khai triển sẽ xuất hiện thêm [E,G]. Nhưng các phần tử của E,G vẫn là byte, nên phần bậc hai đó nhỏ hơn modulus rất nhiều. Mình giữ nó làm sai số của CVP thay vì bỏ đi.

## không cần tìm số mũ

Trước tiên, với hai số mũ $a,b\geq0$, ta có:

$$
A^aA^b=A^{a+b}=A^bA^a.
$$

Tính chất này đúng cả khi $A$ không khả nghịch. Ta không cần giả sử `A` thuộc một nhóm ma trận khả nghịch nào cả.

Đặt ký hiệu **commutator**, tức hiệu của hai thứ tự nhân:

$$
[X,Y]=XY-YX.
$$

Hai ma trận giao hoán khi và chỉ khi $[X,Y]=0$.

Trong cùng một testcase, xét hai output đầu:

$$
B=A^a+E,\qquad C=A^b+G.
$$

Sau khi trừ đúng nhiễu, chúng phải thỏa:

$$
[B-E,C-G]=0.
$$

Vậy thay vì tìm $A,a,b$, mình tìm hai ma trận byte $E,G$ làm cho biểu thức trên bằng 0. Số ẩn còn lại là:

$$
2(10^2-1)=198,
$$

vì byte đầu của mỗi key đã biết bằng 0.

### Byte đầu bằng 0 có ích gì

Ngoài việc giảm số ẩn, điều kiện này còn loại bỏ một mơ hồ tự nhiên của mô hình giao hoán.

Với ma trận đơn vị $I$, ta luôn có:

$$
[X-\lambda I,Y-\mu I]=[X,Y].
$$

Nghĩa là nếu chỉ nhìn điều kiện giao hoán, ta không phân biệt được việc dịch các phần tử đường chéo của nhiễu cùng một lượng. Ràng buộc $E_{0,0}=G_{0,0}=0$ cố định hai hướng dịch vô hướng này.

Điều đó không tự chứng minh nghiệm là duy nhất, nhưng là một ràng buộc quan trọng cần giữ lại khi dựng hệ.

## phần bậc hai nhỏ đến mức nào

Khai triển điều kiện giao hoán:

$$
\begin{aligned}
0
&=[B-E,C-G]\\
&=[B,C]-[E,C]-[B,G]+[E,G].
\end{aligned}
$$

Chuyển vế:

$$
\boxed{[E,C]+[B,G]=[B,C]+[E,G].}
$$

Vế trái tuyến tính theo các phần tử của $E,G$, do $B,C$ đã biết. Phần khó duy nhất còn lại là $[E,G]$, vì nó chứa tích giữa hai ẩn.

Nhưng để ý rằng các ẩn đều là byte.

Lấy các đại diện nguyên trong $[0,255]$ của $E,G$, một phần tử của commutator là:

$$
[E,G]_{i,j}
=\sum_{k=0}^{9}E_{i,k}G_{k,j}
-\sum_{k=0}^{9}G_{i,k}E_{k,j}.
$$

Mỗi tổng nằm trong $[0,10\cdot255^2]$, nên:

$$
\left|[E,G]_{i,j}\right|
\leq10\cdot255^2
=650250
<2^{20}.
$$

Trong khi đó modulus `p` có 128 bit. Như vậy ta có một hệ tuyến tính modulo `p`, lệch khỏi vế phải đã biết một lượng chỉ khoảng 20 bit.

> Chỗ này không phải đặt $[E,G]=0$. Ta giữ nó làm sai số nhỏ của bài toán CVP, rồi kiểm tra lại phương trình ma trận đầy đủ sau khi lấy được nghiệm.

Tức là phần bậc hai vẫn còn, nhưng mình không cần symbolic toàn bộ nó để giải :))))

## Dựng lattice cho hai key đầu

### 1. Chuyển ma trận thành hệ tuyến tính

Gọi $H_k$ là ma trận có đúng một phần tử bằng 1 tại vị trí thứ $k$ theo thứ tự từng hàng, còn lại bằng 0. Vì vị trí đầu của nhiễu đã biết, ta chỉ dùng $k=1,\ldots,99$.

Khi đó:

$$
E=\sum_{k=1}^{99}e_kH_k,
\qquad
G=\sum_{k=1}^{99}g_kH_k.
$$

Suy ra:

$$
[E,C]+[B,G]
=\sum_{k=1}^{99}e_k[H_k,C]
+\sum_{k=1}^{99}g_k[B,H_k].
$$


Không nhất thiết phải dùng cả 100 phần tử của commutator để dựng lattice. Lời giải chọn 30 vị trí từ 3 đường chéo vòng:

```python
coords = [(i, (i+j) % n) for j in range(3) for i in range(n)]
```

Đặt $\pi$ là phép lấy các phần tử ở `coords`, theo đúng thứ tự trên. Vector ẩn được xếp thành **vector hàng**:

$$
x=(e_1,\ldots,e_{99},g_1,\ldots,g_{99})\in[0,255]^{198}.
$$

Ta dựng ma trận hệ số $M\in\mathbb Z^{198\times30}$ như sau:

- 99 hàng đầu là $\pi([H_k,C])$.
- 99 hàng sau là $\pi([B,H_k])$.
- Các hệ số trong trường được nâng lên đại diện nguyên để dựng lattice trên $\mathbb Z$.

Với:

$$
\delta=\pi([B,C]),\qquad q=\pi([E,G]),
$$

ta được:

$$
\boxed{xM\equiv\delta+q\pmod p,\qquad |q_j|\leq650250.}
$$

Ở đây $q$ được hiểu là sai số nguyên có dấu ở phần trên, không phải đại diện không âm trong $[0,p-1]$.

Chú ý chiều của `M`: mỗi hàng ứng với một ẩn, mỗi cột ứng với một tọa độ được chọn. Vì vậy biểu thức là $xM$, không phải $Mx$.

Nhìn qua thì 30 phương trình mà tới 198 ẩn có vẻ là thiếu dữ kiện. Nhưng đây không phải bài toán giải một hệ tuyến tính tùy ý trên $\mathbb F_p$: các ẩn chỉ có 256 khả năng, và phần sai số cũng bị chặn rất nhỏ so với `p`. Lattice là cách tận dụng đồng thời các ràng buộc này, thay vì chỉ dùng khử Gauss.

### 2. Đưa vào CVP

Ta cần một điểm lattice vừa thỏa gần đúng hệ modulo, vừa có các tọa độ ẩn nằm trong miền byte. Chọn:

$$
d=198,\qquad m=30,\qquad s=1024.
$$

Basis theo hàng:

$$
L=
\begin{pmatrix}
pI_m & 0_{m\times d}\\
M & sI_d
\end{pmatrix}.
$$

Với các hệ số nguyên $(z,x)$, một điểm trong lattice có dạng:

$$
v=(z,x)L=(pz+xM,\;sx).
$$

Đặt target:

$$
\tau=(\delta,\;128s\cdot\mathbf1_d).
$$

Tại nghiệm đúng, ta chọn được $z$ sao cho $pz+xM=\delta+q$. Khi đó:

$$
\boxed{v-\tau=(q,\;s(x-128\mathbf1_d)).}
$$

Bây giờ hai phần của khoảng cách đều nhỏ:

- Phần đầu là nhiễu bậc hai, mỗi tọa độ có trị tuyệt đối không quá $650250$.
- Phần sau đo độ lệch của byte so với 128, mỗi tọa độ có trị tuyệt đối không quá $1024\cdot128=131072$.

Số 128 là điểm nguyên gần tâm của miền $[0,255]$. Còn `scale = 1024` giúp cân bằng thang đo giữa sai số phương trình và phần byte; đây là tham số được dùng trong lời giải, không phải một hằng số bắt buộc của bài toán.

### 3. Kannan embedding

Mình dùng `kannan_cvp` từ thư viện `lll_cvp`, với `flatter` để rút gọn lattice:

```python
v = kannan_cvp(
    L,
    target,
    reduction=flatter,
    weight=scale * 256,
)
```

Ý tưởng của embedding là thêm target vào basis:

$$
\widetilde L=
\begin{pmatrix}
L & 0\\
-\tau & w
\end{pmatrix}.
$$

Nếu $v$ gần $\tau$, lattice mới chứa vector ngắn $(v-\tau,w)$. Trong code, $w=1024\cdot256$.

`scale` và `weight` có vai trò khác nhau: `scale` nhân vào các tọa độ byte của bài toán gốc, còn `weight` là tọa độ thêm vào ở bước embedding.

Basis ban đầu có kích thước $228\times228$ ; sau embedding là $229\times229$. Từ điểm lattice trả về, 198 tọa độ cuối chính là $sx$, nên chia lại cho `scale` để lấy các byte của hai key.

Ở bước này, 30 tọa độ đầu không cần bằng target, vì vẫn còn sai số $q$. Thay vào đó, code kiểm tra:

```python
assert all(0 <= value <= 255 for value in vals)
assert (B-E)*(C-G) == (C-G)*(B-E)
```

Cả 100 phần tử của đẳng thức ma trận đều được kiểm tra, không chỉ 30 tọa độ đã chọn.

> Lựa chọn 30 tọa độ giúp giảm kích thước lattice; không có khẳng định rằng chúng đều độc lập hay luôn đủ cho mọi dữ liệu. Tương tự, Kannan embedding kết hợp rút gọn lattice ở đây là cách tìm ứng viên, không phải lời bảo đảm rằng thư viện luôn trả về nghiệm CVP chính xác. Các bước kiểm tra sau đó là bắt buộc.

## Key thứ ba: lúc này chỉ còn tuyến tính

Sau khi có $E$ của output đầu, ta tính được:

$$
W=B-E=A^a.
$$

Gọi output thứ ba là $C_2=A^{r_2}+G_2$. Vì phần không nhiễu vẫn giao hoán với $W$:

$$
[W,C_2-G_2]=0.
$$

Suy ra:

$$
\boxed{[W,G_2]=[W,C_2].}
$$

Khác với bước trước, ở đây $W$ đã biết. Không còn tích giữa hai ma trận nhiễu chưa biết nữa, nên hệ này **tuyến tính chính xác modulo `p`**.

Ta chỉ còn 99 ẩn byte. Code dùng 20 tọa độ từ 2 đường chéo vòng:

```python
coords = [(i, (i+j) % n) for j in range(2) for i in range(n)]
```

Gọi $M_2\in\mathbb Z^{99\times20}$ là ma trận có các hàng $\pi([W,H_k])$, và $\delta_2=\pi([W,C_2])$. Ta dựng:

$$
L_2=
\begin{pmatrix}
pI_{20} & 0\\
M_2 & I_{99}
\end{pmatrix},
\qquad
\tau_2=(\delta_2,\;128\mathbf1_{99}).
$$

Ở nghiệm đúng, khoảng cách có dạng:

$$
v_2-\tau_2=(0,\;g-128\mathbf1_{99}).
$$

Lần này phần đầu phải bằng 0, nên code kiểm tra trực tiếp:

```python
assert v[:m] == target[:m]
```

Sau đó vẫn kiểm tra miền byte và toàn bộ đẳng thức:

```python
assert W*(C2-G2) == (C2-G2)*W
```

Basis ở bước này chỉ còn 119 chiều, hoặc 120 chiều sau embedding, với `weight = 256`.

Tóm lại ta không cần dựng một hệ lớn chứa cả ba key ngay từ đầu. Lấy được hai key trước -> có một ma trận sạch -> key còn lại trở thành bài toán đơn giản hơn.

## Ghép lại để giải mã flag

Lặp lại hai bước trên cho cả 5 testcase, mình thu được 15 ma trận nhiễu. Mỗi ma trận được trải phẳng thành key theo đúng thứ tự từng hàng:

```python
key = bytes(map(int, error.list()))
```

Do challenge mã hóa bằng XOR, ta chỉ cần XOR ngược tất cả key vào `enc`:

$$
\text{flag}_{\mathrm{pad}}
=\text{enc}\oplus
\bigoplus_{T=0}^{4}\bigoplus_{j=0}^{2}\text{key}_{T,j}.
$$

Thứ tự XOR không ảnh hưởng kết quả. Cuối cùng bỏ các byte padding `\x00` ở cuối.

Trước khi nhận kết quả, lời giải còn kiểm tra cả ba cặp ma trận đã khử nhiễu trong từng testcase đều giao hoán. Đây là kiểm tra thêm ngoài các tọa độ đã đưa vào lattice.

## solve

```python
import ast
import sys
from itertools import combinations
from pathlib import Path

from sage.all import ZZ, GF, matrix, vector, identity_matrix, block_matrix
from lll_cvp import flatter, kannan_cvp

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "files"

params = dict(line.split("=") for line in (DATA / "params").read_text().splitlines())

p, n, t, c = (int(params[k]) for k in ("p", "n", "t", "c"))
F = GF(p)


def recover_pair(B, C):
    coords = [(i, (i+j) % n) for j in range(3) for i in range(n)]
    rows = []

    for side in range(2):
        for k in range(1, n*n):
            H = matrix(F, n, n)
            H[k//n, k%n] = 1
            D = H*C - C*H if side == 0 else B*H - H*B
            rows.append([ZZ(D[i, j]) for i, j in coords])

    M = matrix(ZZ, rows)
    d, m = M.dimensions()
    scale = 1024
    L = block_matrix(ZZ, [
        [p*identity_matrix(ZZ, m), matrix(ZZ, m, d)],
        [M, scale*identity_matrix(ZZ, d)],
    ])

    D = B*C - C*B
    target = vector(ZZ,
        [ZZ(D[i, j]) for i, j in coords] + [scale*128]*d
    )
    v = kannan_cvp(L, target, reduction=flatter, weight=scale*256)
    vals = [ZZ(value)//scale for value in v[m:]]

    E = matrix(F, n, n, [0] + vals[:n*n-1])
    G = matrix(F, n, n, [0] + vals[n*n-1:])
    return E, G


def recover_remaining(W, C):
    coords = [(i, (i+j) % n) for j in range(2) for i in range(n)]
    rows = []

    for k in range(1, n*n):
        H = matrix(F, n, n)
        H[k//n, k%n] = 1
        D = W*H - H*W
        rows.append([ZZ(D[i, j]) for i, j in coords])

    M = matrix(ZZ, rows)
    d, m = M.dimensions()
    L = block_matrix(ZZ, [
        [p*identity_matrix(ZZ, m), matrix(ZZ, m, d)],
        [M, identity_matrix(ZZ, d)],
    ])

    D = W*C - C*W
    target = vector(ZZ, [ZZ(D[i, j]) for i, j in coords] + [128]*d)
    v = kannan_cvp(L, target, reduction=flatter, weight=256)

    vals = list(v[m:])

    G = matrix(F, n, n, [0] + vals)
    return G


plaintext = bytearray((DATA / "enc").read_bytes())

for case in range(t):
    data = ast.literal_eval((DATA / f"testcase_{case}.in").read_text())
    B = [matrix(F, n, n, row) for row in data]

    E0, E1 = recover_pair(B[0], B[1])
    E2 = recover_remaining(B[0]-E0, B[2])
    errors = [E0, E1, E2]
    powers = [b-e for b, e in zip(B, errors)]

    for error in errors:
        key = bytes(map(int, error.list()))
        assert key[0] == 0
        for i, value in enumerate(key):
            plaintext[i] ^= value


flag = bytes(plaintext).rstrip(b"\x00")
print(flag.decode())
```

Vậy là lấy được flag:

```text
CTF{7ff8b019311e3394808f55ebaa1e9c7cef048a6c8681074d0cda751a85dbe9df}
```

## Tài liệu tham khảo

- [lll_cvp — maple3142](https://github.com/maple3142/lll_cvp)
- [flatter — keeganryan](https://github.com/keeganryan/flatter)
- [MRSA](https://github.com/Connor-McCartney/Connor-McCartney.github.io/tree/main/_pages/cryptography/other)