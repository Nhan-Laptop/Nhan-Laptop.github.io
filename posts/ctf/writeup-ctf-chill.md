---
date: 2026-07-13
summary: A short collection of crypto challenge notes, including symbolic and Groebner-basis based solving patterns from recent CTF tasks.
tags:
  - crypto
  - groebner-basis
  - sage
  - ctf-notes
---

# CTF CHILL

> Nhan_laptop |
> --


> Một số chall mình thấy hay 
> --- 



## Flagtrix - HCMUS-CTF2025

chall: 
```python!
import string 
from sage.all import * 
from hashlib import sha256 
from Crypto.Util.number import getPrime, bytes_to_long as btl 

FLAG = b'HCMUS-CTF{surely_this_is_the_real_flag_xdd_136825d2dc8a9658e}'

assert len(FLAG) == 61 
assert sha256(FLAG).hexdigest() == '136825d2dc8a9658e7e41d9c9a9180dc7eeed802b7801b9836f9d012c4986f7e'
assert all(x in (string.ascii_letters + string.digits + '_').encode() for x in FLAG.lstrip(b'HCMUS-CTF{')[:-1])

p = getPrime(1024)
q = getPrime(1024)
n = p * q 

M = Matrix(Zmod(n), [
            [btl(FLAG[:len(FLAG) // 4]), btl(FLAG[len(FLAG) // 4:2 * len(FLAG) // 4]) ], 
            [btl(FLAG[2 * len(FLAG) // 4:3*len(FLAG) // 4]), btl(FLAG[3 * len(FLAG) // 4:])]
])

print((M ** 137).list())
print(n)
```

Bài này thì mình symbolic lên và xem trạng thái biến đổi. 
Chú ý ở đây: M * C  = C * M   vì M ^ 137 * M = M * M ^ 137, mình sẽ sử dụng phương trình này để giải bằng `groebner_basis`.

solve:
```python!

import string 
from hashlib import sha256 
from Crypto.Util.number import *
from sage.all import * 
c = '...'
ci = c
n = 25093610144908461464059057408568647065852509496910506454219029231729615790182838521750666866220278951668213036781863233070073888264737231955166698931256387186706709967683366405223674886514417461424423811600936935913459851157466271803054923435838872834203098196847763934619584820142686420544929795531754633813915442819237995875546815902669291787704729075851900787370032144290248373787526232788049121242923165373815660903262194195632414516883985594279799045995517317604084920418118272895521418338434234634526455272161460427621237242918538081864414570820209101902145835308168984602150410855452852774414322666120594785481
e = 137
k = 2
c = Matrix(Zmod(n),k,k,c)
FLAG = b'HCMUS-CTF{surely_this_is_the_real_flag_xdd_136825d2dc8a9658e}'

assert len(FLAG) == 61 
##################Part1############################### 


Pring,flag =  PolynomialRing(Zmod(n), 'k',4 ).objgens()

FLAG = [i for i in flag]

M  = Matrix(2,2,FLAG)
T = M * c - c* M 

sol = ideal([T[0][0],T[0][1],T[1][0],T[1][1] ]).groebner_basis()
"""
sol = [k0 + a*k2 + b*k3, k1 + c*k2]
Vì phương trình 2 có thể giải bằng Lattice nên ta sẽ giải trước!
"""
mat1, v1 = Sequence([sol[1]]).coefficients_monomials(sparse=False)

mat1 = mat1.T.change_ring(ZZ)

mat1 = mat1.augment(matrix.identity(2)).stack(vector(ZZ, [n, 0, 0]))
W = Matrix.diagonal(ZZ, [2 ** 256, 1, 1])

lll = (mat1 * W).LLL() / W 

mat = lll[0]
Flag1 = mat[1]
Flag2 = mat[2]
Alphabet = string.ascii_letters + string.digits + '_' 
Alphabet = Alphabet.encode()
for k in range(1,100):
    f1 = Flag1 * (-k)    
    f2 = Flag2 * (-k)

    if all([i in Alphabet for i in long_to_bytes(int(f1))]) and all([i in Alphabet for i in long_to_bytes(int(f2))]):
        break

# print(long_to_bytes(int(f1)),long_to_bytes(int(f2)))


##################Part2############################### 
FLAG = [i for i in flag]
FLAG = matrix(2,2,[FLAG[0]] + [Zmod(n)(f1),Zmod(n)(f2)] + [FLAG[-1]])

C  = matrix(Zmod(n),2,2,ci)
CI = FLAG**137

tmp = CI - C 

sol = ideal(tmp.list()).groebner_basis()

print(sol)

tmp = [Zmod(n)(-i.constant_coefficient()) for i in sol]
f0, f3 = [long_to_bytes(int(i)) for i in tmp]
print(f0 +long_to_bytes(int(f1)) + long_to_bytes(int(f2))+ f3 )
```

## TFCCTF2025 - DEEZERRORS

chall:
```python!
from Crypto.Util.number import long_to_bytes, bytes_to_long
import random
from sage.all import * 
from secret import flag

mod = 0x225fd
flag = bytes_to_long(flag)
e_values = [97491, 14061, 55776]
S = (lambda f=[flag], sk=[]: ([sk.append(f[0] % mod) or f.__setitem__(0, f[0] // mod) for _ in iter(lambda: f[0], 0)],sk)[1])()
S = vector(GF(mod), S)

A_save = []
b_save = []

for i in range(52):
    A = VectorSpace(GF(mod), 44).random_element()
    e = random.choice(e_values)
    b = A * S + e
    #print(b)

    A_save.append(A)
    b_save.append(b)

open('out.txt', 'w').write('A_values = ' + str(A_save) + ' ; b_values = ' + str(b_save))
```
Hmm tóm lại là ta sẽ có được 3 error và rất lớn. 
Nhận xét: 
- `[97491, 14061, 55776]` là dãy tăng dần đều ( sắp lại ) và `97491 - 55776 = 55776 - 14061 != 0 mod p `.
- Cái hàm người ta cho: `S = (lambda f=[flag], sk=[]: ([sk.append(f[0] % mod) or f.__setitem__(0, f[0] // mod) for _ in iter(lambda: f[0], 0)],sk)[1])()` - thật chất chỉ là băm nhỏ theo mod -> tạo vector : S . 

Solve: 
Mình biến đổi như sau: 

\begin{align*}
a = 14061, \quad b = 55776, \quad c = 97591; \quad t = b; \quad \Delta = b - a 
\end{align*}

\begin{align*}
\text{Ta có:} \quad a = t - \Delta,\quad b = t,\quad c = t + \Delta \
\end{align*}
Ta sẽ đưa về dạng `{-1,0,1}` tiêu chuẩn như sau: 
$$
e \in \{t-\Delta,\ t,\ t+\Delta\}
$$

$$
\Rightarrow e' \in \{-1,0,1\} = (e - t ) * delta ^{-1}
$$

$$
\Rightarrow A*s + b = e \mod{p} \Leftrightarrow A*s *  delta^{-1}  - (b_{vector} + t) *  delta ^ {-1}  =  (e - t)  *  delta ^ {-1} \mod{p}
$$
Thì lattice như này: 


$$
\begin{aligned}
& s_0 \cdot
\begin{bmatrix}
A_{0,0} \\ A_{1,0} \\ \vdots \\ A_{m,0}
\end{bmatrix} \cdot delta^{-1}
\;+\;
s_1 \cdot
\begin{bmatrix}
A_{0,1} \\ A_{1,1} \\ \vdots \\ A_{m,1}
\end{bmatrix} \cdot delta^{-1}
\;+\;\cdots +\;
s_n \cdot
\begin{bmatrix}
A_{0,n} \\ A_{1,n} \\ \vdots \\ A_{m,n}
\end{bmatrix}\cdot delta^{-1} -\,1 \cdot
\begin{bmatrix}
b_0 + t  \\ b_1 + t \\ \vdots \\ b_m + t 
\end{bmatrix} \cdot delta^{-1} +\,
\begin{bmatrix}
1_0   \\ 1_1  \\ \vdots \\ 1_m  
\end{bmatrix} 
\;+\;
k_0 \cdot
\begin{bmatrix}
p \\ 0 \\ \vdots \\ 0
\end{bmatrix} 
\;+\;
k_1 \cdot
\begin{bmatrix}
0 \\ p \\ \vdots \\ 0
\end{bmatrix}
\;+\;\cdots +\;
k_m \cdot
\begin{bmatrix}
0 \\ 0 \\ \vdots \\ p
\end{bmatrix} 
 = \begin{bmatrix}
e_0' \\ e_1' \\ \vdots \\ e_m'
\end{bmatrix}
\end{aligned}
$$

Chú ý: trong lattice này mình phải thêm vector toàn `1` vào vì vector ngắn nhất của chúng ta là có số -1 nên lúc tính sẽ bị mũ lên và trở thành dương -> típ là  ta phải `+1`.

```python!

from Crypto.Util.number import *
import random
from sage.all import * 
import json 
from lll_cvp import reduce_mod_p
from out import A_values as A , b_values as b


e = [97491, 14061, 55776]
es = sorted(e)
Ai = A
bii = b 
a,bi,c = es 
p = 0x225fd
K = GF(p)
m = 52
n = 44 

delta = bi -a 
inv_delta = int(inverse(delta,p))
A = matrix(ZZ,m,n,A) * inv_delta
b = (vector(ZZ,b) + vector(ZZ,[bi]*len(b)) ) * inv_delta  

mat = A.augment(b).augment(vector(ZZ,m*[1])).augment(identity_matrix(ZZ,m)*p).T

matlll = mat.BKZ(block_size = 20)

for rr in matlll:
    if (all([i == 1 or i == 0 or i == -1 for i in rr]) and 
            all([i == 1  for i in rr]) != 1 and 
                all([i == 0  for i in rr]) != 1 ) :
                    
                    print(rr)
                    break

mat = mat.change_ring(K)
sol = mat.solve_left(rr)

print(sol)
s  = sol[:n]
s   = s.list()

def revert_from_sk(sk, mod):
    res = 0
    for d in reversed(sk):
        res = res * mod + int(d)
    return res
print(long_to_bytes(int(revert_from_sk(s,p))).decode())

"""
As *  delta ^ -1  - (b + t) *  delta ^ -1  =  (e - t)  *  delta ^ -1   
t - e = -1   , t  = 0 , t + e = 1  
"""
```


## ImaginaryCTF 2025 - scalar division: 

### Unintended
chall:
```python!
assert ((E:=EllipticCurve(GF(0xbde3c425157a83cbe69cee172d27e2ef9c1bd754ff052d4e7e6a26074efcea673eab9438dc45e0786c4ea54a89f9079ddb21),[5,7])).order().factor(limit=2**10)[3][0]*E.lift_x(ZZ(int.from_bytes((flag:=input('ictf{')).encode())))).x() == 0x686be42f9c3f431296a928c288145a847364bb259c9f5738270d48a7fba035377cc23b27f69d6ae0fad76d745fab25d504d5 and not print('\033[53C\033[1A}')
```
Ta có: 
 - `Q  = r * P ` với: r là prime thứ 3 của factor(order)  và P là phần tử flag. 
 - Biết được curve gốc, `Q,r`.

Solve:

Ban đầu mình nghĩ là chỉ cần dịch ngược  `r` lại rồi nhân cho `Q` là ra. Nhưng vì `r | order` nên thất bại. 
Nên ý tưởng là ta sẽ giải bài toán con trên các phần tử prime còn lại - tương tự bài toán Pohlig Hellman.
Vì N là tích các thừa số nguyên tố thì theo định lí phân rã nhóm abelian hữu hạn, ta có phân rã trực giao:![image](https://hackmd.io/_uploads/BJbd35a5ee.png)
Trong đó $G_i$ là Sylow qi- component (các phần tử có phần bậc lũy thừa của thừa số nguyên tố). Mỗi phần tử $R\in E(F_p)$ được viết dưới dạng: $P = ∑_i*P_i$ với $G_i$.
Sau cùng chỉ là bước dịch ngược $r$ trên từng nhóm con. 
Và cuối cùng ta tính tổng các giá trị đó lại: ![image](https://hackmd.io/_uploads/rkoUJjaqel.png)
Vì P mới chỉ là tổng của các phân rã - không có r-subgroup nên ta cần tính lại: lấy random một point rồi nhân với `N//r` tạo point thuộc nhóm `E[r]`, và cuối cùng là sẽ là tìm toàn bộ điểm trên nhóm. 

solve.py:
```python!
# preimages_of_scalar_fixed.sage
from sage.all import *
from Crypto.Util.number import *
p = 0xbde3c425157a83cbe69cee172d27e2ef9c1bd754ff052d4e7e6a26074efcea673eab9438dc45e0786c4ea54a89f9079ddb21
a = 5
b = 7
target_x = 0x686be42f9c3f431296a928c288145a847364bb259c9f5738270d48a7fba035377cc23b27f69d6ae0fad76d745fab25d504d5
order_ = 1915401112669764832155688444967632063685280552714174698559105795993909088154715053733286568457561836692127326936769038088
r = 457

F = GF(p)
E = EllipticCurve(F, [a, b])

x = E.lift_x(F(target_x))
assert x * (order_//r) == E(0)
list_x = []
list_x.append(x)
list_x.append(-x)


res = []
pr = order_ // r 
tmp = order_ // pr 
q = (x)*inverse(r,pr)
T = E.random_element() * (order_ // r)
import string
for i in range(r):
    P  = q  + i * T

    x = P.xy()[0]
    if  all([i in (string.ascii_letters + string.digits + '_').encode() for i in long_to_bytes(int(x))]):
            print(long_to_bytes(int(x)))

```

### Intended 
Một cách giải khác. 
Vì ta biết được giá trị flag là tọa độ `x - P.x`, và hơn hết là giá trị `a - a * P = Q` là nhỏ.
Solve:
Nhìn vào công thức cộng trên Elliptic: 
![image](https://hackmd.io/_uploads/S1mymgksll.png)
Hình 1: https://giapppp.notion.site/Elliptic-Curve-Cryptography-50d4401770b641349ad235e287b326d0
để ý rằng vì ta chỉ cộng các tọa độ giống nhau nên $\lambda$ sẽ bằng phần sau, mà $\lambda = y^2 = x^3 + a*x + b$ vậy thì $(P*r).x$ chỉ là đa thức 1 biến. 
Rồi bây giờ ta symbolic lên rồi giải. 
Vì đa thức bậc rất lớn - giải tốn thời gian, và hơn nữa là ta chỉ cần tìm 1 nghiệm duy nhất `x = flag`. 
Để ý thấy - fermat nhỏ : 

$$
a ^{p} ≡ a \mod p
$$

Biểu thức này luôn cho ta một nghiệm `a`.
Vì có 2 biểu thức nên ta sẽ dùng `GCD` để tìm lại nghiệm: 
chi tiết cách tấn công: https://adib.au/2025/lance-hard/#speedup-by-using-gcd

```python!
from Crypto.Util.number import *
p = 0xbde3c425157a83cgiá trị be69cee172d27e2ef9c1bd754ff052d4e7e6a26074efcea673eab9438dc45e0786c4ea54a89f9079ddb21
a = 5
b = 7
target_x = 0x686be42f9c3f431296a928c288145a847364bb259c9f5738270d48a7fba035377cc23b27f69d6ae0fad76d745fab25d504d5
order_ = 1915401112669764832155688444967632063685280552714174698559105795993909088154715053733286568457561836692127326936769038088
r = 457
F = GF(p)
E = EllipticCurve(F, [a, b])

f = E.multiplication_by_m(r,1)
f = f.numerator() - target_x * f.denominator()

R = PolynomialRing(F,'x')
r = R.gen()
f = R(f)
g = pow(r, p, f) - r

tmp = f.gcd(g).roots()
for i in tmp:
    x = i[0]
    print(long_to_bytes(int(x)))

"""
b"\xbd\xa7\xdbR\xa1\x89\x1a,UFs\x0f\xfeW\xe7\x94\x9f\xc9z\xc1U|xm\xa4qj\xeb\xc7~\xd3\xcd['\xbeb\x1cj\xe9W\xaa$\x18=\r|vl\xc0Q"
...
b"o\x01\x1cG\xa3\x07\xe4\x1a\xed\xf8\xcd\xd0Qt\xe2\xd0\xc8]B\x83R\xb1\xc5\xbe\x93\xd7\xab\x9c\xd5#gU9\n\xaa\xd4\x88\xd10\x89t\xb5'\x06\x87v\x0b0H"
b'7\x9fQB\xb5k^\xc5\x1e\xdas\xa3;\x08(\x07\xf7\xe9\x1b\xacte\xe39\x1e\x8cH\xf8\x88f\xa9\xd9\xc6\xb3\x08!M\xf1\xa7\xe1\x97@\x8d\xf9\xe8\x06\xf8\xbc\xaa'
b"\x0e\x9e\xde\x9a\x1c\x98\xd0\xd6L}\xd0\x8c\xe6o\xfd'\xd2_H8z\xa6y\x96\xe2\xdf\xbbn\xc8nF\t\xf2?\x8a\xd8+_\xb3\xee>1\xe5h\xb0\xc1\x84\xb5\x04"
b'mayb3_d0nt_m4ke_th3_sca1ar_a_f4ctor_0f_the_ord3r'
"""
```
