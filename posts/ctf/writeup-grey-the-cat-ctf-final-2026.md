---
date: 2026-07-13
summary: A finals recap covering several solved crypto challenges from Grey Cat The Flag Finals 2026, with notes on DSA, lattices, and PRNG reasoning.
tags:
  - crypto
  - dsa
  - lattice
  - prng
---

# Grey Cat The Flag Finals 2026
>Nhan_laptop |
>---
> Crypto player

![image](https://hackmd.io/_uploads/r1SJVQ0zMe.png)

## Motivation and overview 

Vừa rồi mình có tham gia một giải ctf mà ban ai, khá là hay khi mình được trải nghiệm lại những cảm giác từ lúc mới bắt đầu chơi ctf. Hơn hết là 5 tiếng đầu mình đã cụt tay và phải đọc lại syntax và các wu khá là nhiều ....

Trong blog này mình sẽ giải thích chi tiết các bài mình đã giải được trong giải: 



| Name | Category | Tags |   Difficulty  |
| -------- | -------- | -------- | --- |
|     [Efficient DSA Algorithm](https://hackmd.io/KWEhcXxxS3KhGrIZO2fm2g?both#Efficient-DSA-Algorithm)     |    Crypto      |DSA,PRNG          | ★     |
|      [Half Bit Wonder](https://hackmd.io/KWEhcXxxS3KhGrIZO2fm2g?view#Half-Bit-Wonder)    | Crypto          | Lattice, HNP ,PRNG           |  ★★    |
| 	[random brainrot](https://hackmd.io/KWEhcXxxS3KhGrIZO2fm2g?view#random-brainrot)		|   Crypto   |Python, Math      |★★★★     |



## Efficient DSA Algorithm 
![image](https://hackmd.io/_uploads/H1mnVXAGfx.png)

```
.
└── dist-efficient_dsa_algorithm
    ├── cc.py ---------- debug
    ├── efficient_dsa.sage
    ├── hall.py-------- debug
    ├── output.txt
    ├── secret.py
    ├── solve.py----- debug
    ├── tmp.py----- debug
    └── vd.py----- debug
```

### chall 

:::spoiler
```python!
#!/usr/bin/env sage
from hashlib import sha256
from importlib import util
from itertools import cycle
from pathlib import Path

from sage.all import EllipticCurve, GF, ZZ, inverse_mod


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
DIST_DIR = ROOT / "dist"

secret_spec = util.spec_from_file_location("secret", SCRIPT_DIR / "secret.py")
secret = util.module_from_spec(secret_spec)
secret_spec.loader.exec_module(secret)



P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240
GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424

E = EllipticCurve(GF(P), [0, 7])
G = E(GX, GY)


def point_mul(k, point=G):
    result = ZZ(k) * point
    if result == E(0):
        return None
    x, y = result.xy()
    return int(x), int(y)


class LFSR:
    def __init__(self, state, mask, width=32):
        state = int(state)
        mask = int(mask)
        width = int(width)
        one = int(1)
        self.state = state & ((one << width) - one)
        self.mask = mask & ((one << width) - one)
        self.width = width

    def bit(self):
        one = int(1)
        out = self.state & one
        feedback = (self.state & self.mask).bit_count() & one
        self.state = (self.state >> one) | (feedback << (self.width - one))
        return out

    def bits(self, count):
        return [self.bit() for _ in range(count)]


def lfsr_int(lfsr, count):
    return int("".join(map(str, lfsr.bits(count))), 2)


def sign(message, private_key, lfsr):
    z = int.from_bytes(sha256(message).digest(), "big") % N
    k = lfsr_int(lfsr, 256) % N
    if k == 0:
        raise RuntimeError("zero nonce")
    r = point_mul(k)[0] % N
    s = inverse_mod(k, N) * (z + r * private_key) % N
    return int(r), int(s)


def main():
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    flag = secret.FLAG
    private_key = ZZ(secret.SECRET_D) % N
    lfsr = LFSR(secret.SECRET_LFSR_STATE, secret.SECRET_LFSR_MASK)
    lfsr_output = "".join(map(str, lfsr.bits(96)))

    message = b"give me the flag"
    r, s = sign(message, private_key, lfsr)
    pub = point_mul(private_key)
    key = sha256(int(private_key).to_bytes(int(32), "big")).digest()
    ciphertext = bytes(a ^ b for a, b in zip(flag, cycle(key))).hex()

    (DIST_DIR / "sample_output.txt").write_text(
        "\n".join(
            [
                f"p = {hex(P)}",
                f"n = {hex(N)}",
                f"Gx = {hex(GX)}",
                f"Gy = {hex(GY)}",
                f"message = {message!r}",
                f"lfsr_output = {lfsr_output!r}",
                f"public_key_x = {hex(pub[0])}",
                f"public_key_y = {hex(pub[1])}",
                f"r = {hex(r)}",
                f"s = {hex(s)}",
                f"ciphertext = {ciphertext!r}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

```
:::


đọc source thì mình thấy có 2 hướng để attack, hướng đầu tiên biết được là: 

```python!
/.../.../

P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240
GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424

E = EllipticCurve(GF(P), [0, 7])
G = E(GX, GY)

<------------------>

def point_mul(k, point=G):
    result = ZZ(k) * point
    if result == E(0):
        return None
    x, y = result.xy()
    return int(x), int(y)


class LFSR:
    def __init__(self, state, mask, width=32):
        state = int(state)
        mask = int(mask)
        width = int(width)
        one = int(1)
        self.state = state & ((one << width) - one)
        self.mask = mask & ((one << width) - one)
        self.width = width

    def bit(self):
        one = int(1)
        out = self.state & one
        feedback = (self.state & self.mask).bit_count() & one
        self.state = (self.state >> one) | (feedback << (self.width - one))
        return out

    def bits(self, count):
        return [self.bit() for _ in range(count)]


def main():
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    flag = secret.FLAG
    private_key = ZZ(secret.SECRET_D) % N
    lfsr = LFSR(secret.SECRET_LFSR_STATE, secret.SECRET_LFSR_MASK)
    lfsr_output = "".join(map(str, lfsr.bits(96)))

    message = b"give me the flag"
    r, s = sign(message, private_key, lfsr)
    pub = point_mul(private_key)
    key = sha256(int(private_key).to_bytes(int(32), "big")).digest()
    ciphertext = bytes(a ^ b for a, b in zip(flag, cycle(key))).hex()


```


Đầu tiên là cái curve, mình xem có thể attack vào đó không, thì mình tra được nó là: 
![image](https://hackmd.io/_uploads/SJHkdQRzfg.png)

Nên hướng này không khả thi.

và hướng còn lại là PRNG - custom LCG 

### Solve 

> ref: 
> 1. https://hackmd.io/@giangnd/rJjnnaY50
> 2. https://tang.cat/2024/07/15/HITCON-CTF-2024-Qual-Crypto-Writeup.html#lfsr-filter-function
>
> ở Bài này thì mình làm được 2 cách tiếp cận khác nhau và hơn hết là 3 cách imple:))))



Có thể dễ thấy được ở hàm gen: 

```python!
 def bit(self):
	one = int(1)
	out = self.state & one
	feedback = (self.state & self.mask).bit_count() & one
	self.state = (self.state >> one) | (feedback << (self.width - one))
	return out

def bits(self, count):
	return [self.bit() for _ in range(count)
```

ở hàm bit thì ta có thể viết lại hoàn toàn bằng: 
```python!
# https://tang.cat/2024/07/15/HITCON-CTF-2024-Qual-Crypto-Writeup.html#lfsr-filter-function

class LFSRSymbolic:
    def __init__(self, n, key, mask):
        assert len(key) == n, "Error: the key must be of exactly 128 bits."
        self.state = key
        self.mask = mask
        self.n = n
        self.mask_bits = [int(b) for b in bin(self.mask)[2:].zfill(n)]
        
    def update(self):
        s = sum([self.state[i] * self.mask_bits[i] for i in range(self.n)])
        self.state = [s] + self.state[:-1]
        
    def __call__(self):
        b = self.state[-1]
        self.update()
        return b

```
Dễ hiểu được, ở hàm: 
```py!
feedback = (self.state & self.mask).bit_count() & one
```

thì bản chất là: 
```py!
s1 s2 s3 s4... s32 
&
m1 m2 m3 m4... m32 

```
xor lại với nhau và đếm bit 1, thì vấn đề đặt ra là làm sao ta biết được bit nào là bit 1 và bit nào là 0 rồi sao lại cộng lại, đơn giản là: 
```py!
s1 & m1  ---> tương đương  s1 * m1 (trong trường GF(2))
```
và nếu có n lẻ tổng các tích các bit --> 1, Suy lận 1 tí:
Gọi : 
\begin{equation}
f(x \mid x_i,\; i\in\{0,\ldots,31\})=\mathrm{feedback}.
\end{equation}

Ta có bản chân trị - ta làm với 3 biến bit cho dễ hình dung, từ đó rút ra được phương trình chính: 



| x_1 |   x_2  | x_3 | f(x) |
| --- | --- | --- | ---- |
| 0   | 0    | 0   |     0 |
| 0   |  0   |  1  |     1 |
| 0   |   1  |   0 |      1|
|   0  |   1  |   1  |    0  |
|   1  |  0   |    0 |    1  |
|    1 |   0  |     1|    0  |
|    1 |   1  |     0|     0 |
|   1 |    1 | 1   |      1|

Rút gọn k-map: 


| x_1/x_2x_3 | 00  | 01  | 11  | 10   |
| ---------- | --- | --- | --- | ---- |
|0            |   0  |1     | 0    | 1     |
| 1           |   1  | 0    |  1   | 0 |

Nhóm các ô: 
- Ô $(0, 0, 1) \rightarrow \overline{x_1}\;\overline{x_2}x_3$
- Ô $(0, 1, 0) \rightarrow \overline{x_1}x_2\overline{x_3}$
- Ô $(1, 0, 0) \rightarrow x_1\overline{x_2}\;\overline{x_3}$
- Ô $(1, 1, 1) \rightarrow x_1x_2x_3$

Hàm dưới dạng tổng các tích  là:
\begin{aligned}
f(x_1, x_2, x_3) &= \overline{x_1}\;\overline{x_2}x_3 + \overline{x_1}x_2\overline{x_3} + x_1\overline{x_2}\;\overline{x_3} + x_1x_2x_3\\
&= \overline{x_1}(\overline{x_2}x_3 + x_2\overline{x_3}) + x_1(\overline{x_2}\;\overline{x_3} + x_2x_3)\\
&= \overline{x_1}(x_2 \oplus x_3) + x_1(\overline{x_2 \oplus x_3})\\
&= x_1 \oplus x_2 \oplus x_3\ \  (\overline{x_1}Y + x_1\overline{Y} = x_1 \oplus Y)\\
&\downarrow\\
f(x) = \sum_{i=0}^{31}x_i 
\end{aligned}

Và phép $\oplus$ chính là phép cộng trong trường GF(2), vậy ta có thể viết lại hoàn chỉnh, công thức cho phần feedback là: 

\begin{aligned}
\text{feedback} &= \text{(self.state & self.mask).bit_count() & one}\\
&\downarrow\\
G(s|secret,m|mask)&= \sum_{i=0}^{31}(s_i\cdot m_i) 
\end{aligned}


và ta được cho hơn 96 phương trình nên có thể dùng z3 (hoặc GF(2), Boolean - PolynomialRing().objgens ở cách giải như vậy nhưng mà hơi lâu lúc build)


solve z3: 

:::spoiler
```py!
#!/usr/bin/env sage
from sage.all import *
from z3 import * 
from hashlib import sha256
from importlib import util
from itertools import cycle
from pathlib import Path



SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent
DIST_DIR = ROOT / "dist"

secret_spec = util.spec_from_file_location("secret", SCRIPT_DIR / "secret.py")
secret = util.module_from_spec(secret_spec)
secret_spec.loader.exec_module(secret)



P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
GX = 55066263022277343669578718895168534326250603453777594175500187360389116729240
GY = 32670510020758816978083085130507043184471273380659243275938904335757337482424

E = EllipticCurve(GF(P), [0, 7])
G = E(GX, GY)
print(G.order())
# print(bin(secret.SECRET_LFSR_MASK))
# print(secret.SECRET_LFSR_MASK.bit_count())
# # exit()
print()
class LFSR:
    def __init__(self, state, mask, width=32):
        state = int(state)
        mask = int(mask)
        width = int(width)
        one = int(1)
        self.state = state & ((one << width) - one)
        # print(bin(self.state)[::-1])
        # print(self.state.bit_length())
        # exit(0)
        self.mask = mask & ((one << width) - one)
        self.width = width

    def bit(self):
        one = int(1)
        out = self.state & one
        # print(f'first = {bin(self.state & self.mask)}')
        # print(f'first = {(self.state & self.mask).bit_count()}')
        # print(f'first = {bin(self.state)}')
        # print(f'frist = {bin(self.mask) = }')
        feedback = (self.state & self.mask).bit_count() & one
        self.state = (self.state >> one) | (feedback << (self.width - one))
        # print(f'{bin((feedback << (self.width - one))) = }')
        # print(f'{bin(self.state)= }')
        # print(f'{feedback = }')
        # print(f'{feedback.bit_count()= }')
        # print(f'{out = }')
        # print()
        return out

    def bits(self, count):
        return [self.bit() for _ in range(count)]




p = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f
n = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141
Gx = 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798
Gy = 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8
message = b'give me the flag'
lfsr_output = '010000100111011111111111000000111010011010000101011101101001000100101111000111110000100011001011'
public_key_x = 0x2823a4a1e19df5c95e472857c16bd012605d9ad5a93b1fdc5c3d180ef7aa585e
public_key_y = 0xa2874fa3fa7044ae9882fd4f025bb52920aeae199d163416b55e4f467c798db2
r = 0x2127c19135a1b2df658dbfc9f1a829b3af622e258163ef5c71beefef72a109ea
s = 0x273b6c6521dd5db6a183bdb5dc64b8288c11c49b7d5abc817a95deff41dbae7b
ciphertext = '2c9ac7e94a38f1efb4c23758eac7fa00e3e618f408fde7b37e59bf15925918be6ac983ed'

    
st = [BitVec(f's_{i}',1) for i in range(32)]
ms = [BitVec(f'm_{i}',1) for i in range(32)]

tmp_st = st
tmp_ms = ms 

res =list( map(int,lfsr_output))

S = Solver()
for id1 in range(96): 
    bitt = st[-1]
    tmp = sum([st[i] * ms[i] for i in range(32)])
    st = [tmp] + st[:-1]
    S.add(bitt==res[id1])

print(S.check())
m = S.model()
print(m)
res_st = [m[tmp_st[i]]for i in range(32)]
res_ms = [m[tmp_ms[i]]for i in range(32)]

print()
print(res_st)
print(res_ms)
print(lfsr_output)


res_st = "".join(map(str,res_st))
res_ms = "".join(map(str,res_ms))

print(res_st)
print(res_ms)

res_st = int(res_st,2)
res_ms = int(res_ms,2)


print(res_st)
print(res_ms)

from hall import lfsr_int, point_mul  

message = b"give me the flag"
def sign(message, private_key, lfsr):
    z = int.from_bytes(sha256(message).digest(), "big") % N
    k = lfsr_int(lfsr, 256) % N
    if k == 0:
        raise RuntimeError("zero nonce")
    r = point_mul(k)[0] % N
    s = inverse_mod(k, N) * (z + r * private_key) % N
    return int(r), int(s)

lfsr = LFSR(res_st,res_ms)
lfsr_output = "".join(map(str, lfsr.bits(96)))

k = lfsr_int(lfsr, 256) % N


r1 = point_mul(k)[0] %N
print(r1)
print(r)
z = int.from_bytes(sha256(message).digest(), "big") % N

"""
s = k^-1 * (z + r *d )% N
s * k = z + r * d 
s * k - z = r * d 
"""

F = GF(N)

d = inverse_mod(r,N) * (s * k - z)
d = d % N 
print(d)
P  = G * d 
print(P.xy())
print(public_key_x)
print(public_key_y)
key = sha256(int(ZZ(d)).to_bytes(int(32), "big")).digest()
ciphertext=bytes.fromhex( ciphertext)

print(ciphertext)


ciphertext = bytes(a ^ b for a, b in zip(ciphertext, cycle(key)))
print(ciphertext.decode())
```
:::

pseudocode cho sagemath: 

:::spoiler
```py!
R,fi = BooleanPolynomialRing(64,'x').objgens()

state_sym = list(fi[:32])
mask_sym = list(fi[32:])

assert len(state_sym)== 32 
assert len(mask_sym)== 32 
lfsr_output = list(map(int,lfsr_output))
# print(lfsr_output)
# exit(0)

zeros = []
for t in range(96):
    print(t) 
    bit = state_sym[-1]
    # print(bit)
    s1 = sum([state_sym[i] * mask_sym[i] for i in range(32)])
    # print(s1)
    state_sym = [s1] + state_sym[:-1]
    zeros.append(bit - lfsr_output[t])
    # exit(0)

sol = ideal(zeros).groebner_basis()

for i in sol:
    print(i)
```
:::


Còn một hướng tìm luôn được secret. 
### Cách 2
```py!
one = int(1)
out = self.state & one
feedback = (self.state & self.mask).bit_count() & one
self.state = (self.state >> one) | (feedback << (self.width - one))
```
tương đương với: 

```py!
state = bit | state>>1 
output --> state & 1

```
Và hơn hết đề cho mình 96bits đầu tiên luôn :) 
clm trôn vl, đúng theo lí thuyết là phải cho theo n steps để mất đi cái giá trị của secret

tức là với n bits đầu của lfsr_output thì chính là sercet luôn. 
Và hơi ảo chắc do ông author bị gì.... khó nói :) 

solve: 
:::spoiler
```python!

def solve(state_sym, mask_sym, lfsr_output):
    state_int = int("".join(map(str, state_sym)), 2)

    lfsr_output = list(map(int,lfsr_output))

    S = Solver()
    for t in (range(96)):
        bit = state_sym[-1]
        s1 = sum([state_sym[i] * mask_sym[i] for i in range(32)])
        state_sym = [s1] + state_sym[:-1]
        S.add(bit == lfsr_output[t])
    if (S.check())!= sat: 
        return 0 
    m = S.model()
    print(m)
    mask_int = int("".join([str(m.eval(mask_sym[i], model_completion=True).as_long()) for i in range(32)]),2)
    lfsr = LFSR(state_int, mask_int)

    lfsr_output = "".join(map(str, lfsr.bits(96)))

    k = lfsr_int(lfsr, 256) % N


    r1 = point_mul(k)[0] %N
    print(r1)
    print(r)
    z = int.from_bytes(sha256(message).digest(), "big") % N

    """
    s = k^-1 * (z + r *d )% N
    s * k = z + r * d 
    s * k - z = r * d 
    """

    F = GF(N)

    d = inverse_mod(r,N) * (s * k - z)
    d = d % N 
    print(d)
    P  = G * d 
    print(P.xy())
    print(public_key_x)
    print(public_key_y)
    key = sha256(int(ZZ(d)).to_bytes(int(32), "big")).digest()
    ct = bytes.fromhex(ciphertext)

    print(ct)


    plaintext = bytes(a ^ b for a, b in zip(ct, cycle(key)))
    print(plaintext.decode())
    exit(0)

for length in range(1,33):
    state_sym = lfsr_output[:length][::-1].zfill(32)
    state_int = list(map(int,state_sym))

    solve(state_int, mask_sym, lfsr_output)

```
:::

### Fun facts 

khá là dui khi mình bị nhũng não ở bài này hơn 5 tiếng chẳng hiểu sao, chắc do ...

## Half Bit Wonder
 
![image](https://hackmd.io/_uploads/Hk2VzEAzze.png)
```
.
├── README.md
├── chall.py ---- debug
├── chall.sage
├── output.json
├── solve.py---- debug
└── vd.py ---- debug

````
### chall


:::spoiler

```py!
import hashlib
import json
import random
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
CHALL = ROOT / "chall"

from secret import FLAG, BASE_SEED

q = int(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141)
L = int(2**20)
T = int(20)
M_PER_BLOCK = int(4096)


def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))


def stream_for_sk(sk, nbytes):
    label = ("nothing to see here:" + str(sk)).encode()
    return hashlib.shake_256(label).digest(nbytes)


def build_instance(attempt):
    rng = random.Random(int(BASE_SEED + attempt))
    sk = rng.randrange(int(1), q)
    blocks = []
    ys = []
    all_nonces = []
    used_r = set()

    for _ in range(T):
        r = rng.randrange(int(1), q)
        while r in used_r:
            r = rng.randrange(int(1), q)
        used_r.add(r)

        y = (r * sk) % q
        ys.append(y)
        samples = []
        nonces = []

        for _ in range(M_PER_BLOCK):
            a = rng.randrange(int(1), L)
            
            k = rng.randrange(int(0), q // 2)
            z = (k - a * y) % q
            samples.append([a, str(z)])
            nonces.append(str(k))

        blocks.append({"r": str(r), "samples": samples})
        all_nonces.append(nonces)

    stream = stream_for_sk(sk, len(FLAG))
    ciphertext = xor_bytes(FLAG, stream)
    public = {
        "name": "Half Bit Wonder",
        "q": str(q),
        "L": L,
        "T": T,
        "M_per_block": M_PER_BLOCK,
        "blocks": blocks,
        "ciphertext_hex": ciphertext.hex(),
        "kdf_hint": "key = SHAKE256('nothing to see here:' || decimal(sk))",
    }
    private = {
        "flag": FLAG.decode(),
        "sk": str(sk),
        "q": str(q),
        "L": L,
        "T": T,
        "M_per_block": M_PER_BLOCK,
        "ys": [str(y) for y in ys],
        "nonces": all_nonces,
    }
    return public, private


def main():
    DIST.mkdir(parents=True, exist_ok=True)
    CHALL.mkdir(parents=True, exist_ok=True)

    public, private = build_instance(0)

    with (DIST / "output.json").open("w") as f:
        json.dump(public, f, indent=2)
        f.write("\n")

    with (CHALL / "private.json").open("w") as f:
        json.dump(private, f, indent=2)
        f.write("\n")

    print(f"wrote {DIST / 'output.json'}")
    print(f"wrote {CHALL / 'private.json'}")
    print(f"q = {q} ({q.bit_length()} bits)")
    print(f"L = {L}, T = {T}, M_per_block = {M_PER_BLOCK}")
    print(f"total samples = {T * M_PER_BLOCK}, q//L = {q // L}")


if __name__ == "__main__":
    main()
```

:::


ở chall này thì họ cho: 
```python!

def build_instance(attempt):
    rng = random.Random(int(BASE_SEED + attempt))
    sk = rng.randrange(int(1), q)
    blocks = []
    ys = []
    all_nonces = []
    used_r = set()

    for _ in range(T):
        r = rng.randrange(int(1), q)
        while r in used_r:
            r = rng.randrange(int(1), q)
        used_r.add(r)

        y = (r * sk) % q
        ys.append(y)
        samples = []
        nonces = []

        for _ in range(M_PER_BLOCK):
            a = rng.randrange(int(1), L)
            
            k = rng.randrange(int(0), q // 2)
            z = (k - a * y) % q
            samples.append([a, str(z)])
            nonces.append(str(k))

        blocks.append({"r": str(r), "samples": samples})
        all_nonces.append(nonces)

    stream = stream_for_sk(sk, len(FLAG))
    ciphertext = xor_bytes(FLAG, stream)
    public = {
        "name": "Half Bit Wonder",
        "q": str(q),
        "L": L,
        "T": T,
        "M_per_block": M_PER_BLOCK,
        "blocks": blocks,
        "ciphertext_hex": ciphertext.hex(),
        "kdf_hint": "key = SHAKE256('nothing to see here:' || decimal(sk))",
    }
    private = {
        "flag": FLAG.decode(),
        "sk": str(sk),
        "q": str(q),
        "L": L,
        "T": T,
        "M_per_block": M_PER_BLOCK,
        "ys": [str(y) for y in ys],
        "nonces": all_nonces,
    }
    return public, private
```

Đề cho các khối và  $t$:
-  $y_t = r_t \cdot sk \pmod q$ (với $r_t$ công khai, $sk$ cần tìm).
- Với mỗi sample $i$ trong khối đó,  phương trình:

$$k_i = z_i + a_i \cdot y_t \pmod q$$

- Đề cho : Nonce $k_i$ bị mất bit cao nhất , nghĩa là $k_i$ luôn nằm ở nửa khoảng dưới:

$$0 \le k_i < \frac{q}{2}$$

-  $q$, $L$, $r_t$, $a_i$, $z_i$ mình biết ở output.json. Các hệ số $a_i$ đã được thu nhỏ về khoảng $[0, L)$.

Ông ra đề có nói về Bleichenbacher (Collision-search / Range-reduction). Do $k_i < q/2$, hiệu số giữa $k_i$ và một giá trị nào đó sẽ tạo ra một độ lệch thống kê (modular bias).

Và tìm theo cái bleichenbacher kia thì ra cái này: 
https://fog.misty.com/perry/Bleichenbacher/Bleich-JCE-2014.pdf
:))))


Có nhiều mẫu $(a_i, z_i)$, có thể thiết lập một Hệ lưới (Lattice).


Nhưng mình không làm v :))))))) 

### Solve 

nhìn vào build_instance ở trên thấy được vì nó có quá nhiều PRNG nên mình break nó luôn, ai ngờ được, và bài này mình làm trong 3p :)))))) : 
:::spoiler
```py!
from gf2bv import LinearSystem
from gf2bv.crypto.mt import MT19937
import json 
import hashlib
import json
import random
from pathlib import Path

import random,copy 

q = int(0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141)
L = int(2**20)
T = int(20)
M_PER_BLOCK = int(4096)

print(q.bit_length())




f = open('output.json','r')

c = json.loads(f.read())
f.close()

T = c['T']

print(T)




def xor_bytes(a, b):
    return bytes(x ^ y for x, y in zip(a, b))


def stream_for_sk(sk, nbytes):
    label = ("nothing to see here:" + str(sk)).encode()
    return hashlib.shake_256(label).digest(nbytes)

def build_instance(attempt):
    
    rng = random.Random(int(123123 + attempt))
    lin = LinearSystem([32] * 624)
    mt = lin.gens()

    prng = MT19937(mt)
    zeros = []

    sk = rng.randrange(int(1), q) #<----------
    tmp = prng.getrandbits(256)

    blocks = c['blocks']
    ys = []
    all_nonces = []
    used_r = set()

    for _ in range(1):
        
        r = rng.randrange(int(1), q)#<-------------
        while r in used_r:
            r = rng.randrange(int(1), q)
        used_r.add(r)
        r = int(blocks[_]["r"])
        zeros.append(prng.getrandbits(256)^ (r-1))
        #<-----------

        samples = blocks[_]['samples']
        for _ in range(M_PER_BLOCK):
            az = samples[_]
            a = rng.randrange(int(1), L)
            a  = int(az[0])
            zeros.append(prng.getrandbits(20)^(a -1))

            k = rng.randrange(int(0), q // 2)
            tmp = prng.getrandbits(255)

    print('all done')
    sol = lin.solve_one(zeros)
    print(sol)
    rng = MT19937(sol)
    pyrand = rng.to_python_random()
    sk =pyrand.randrange(int(1), q)
    cipher = c['ciphertext_hex']

    print(cipher)
    ciphertext = bytes.fromhex(cipher)


    print(ciphertext)
    stream = stream_for_sk(sk, len(ciphertext))
    ciphertext = xor_bytes(ciphertext, stream)
    print(ciphertext)


build_instance(0)



```
:::


## random brainrot

![image](https://hackmd.io/_uploads/H1wNrVCzMl.png)

```py!
├── server.py
├── solve.py
├── tmp.py ---- debug
└── vd.py ----- debug
```

### chall 

:::spoiler

```py!
import random
from itertools import cycle

FLAG = "grey{REDACTED}"

class PRNG:
    r = 0
    x = 0
    ct = 0
    
    def __init__(self, r, x):
        self.r = r
        self.x = x
        
        for i in range(1000):
            self.step()
            
    def step(self):
        self.x = self.r * self.x * (1-self.x)
        self.ct += 1
        
    def generate(self):
        while self.ct <= 3000:
            self.step()
            byte = int(self.x * 256)
            yield byte


RR = 3.676 + random.random() * 0.000767676767

RR = float("%.15f"%RR)

start = random.random()

SECRET = random.randbytes(16)
print(SECRET) #debug
print(RR)

p = PRNG(RR, start)

xor = lambda x, y : bytes(a^b for a, b in zip(x, y))

def encrypt(pt):
    ct = xor(xor(p.generate(), pt), cycle(SECRET))
    return ct

try:
    while True:
        
            msg = bytes.fromhex(input("Enter message (in hex): "))

            if (msg == SECRET):
                print("stop hacking!!!!!!!!1")
                print(FLAG)
                break
                
            t = encrypt(msg)

            if (len(t) == 0):
                break

            print(t.hex())
    
except Exception as e:
    pass

```
:::




bài này lúc đầu mình cũng không phải biết giải sau thì mình có đi mò thử các blog nào đó thì mình phát hiện được: 
![image](https://hackmd.io/_uploads/SkGsw4Azzx.png)


thì mình tìm được cái này :)))) 

### logistic map 
> https://en.wikipedia.org/wiki/Logistic_map

#### khái niệm 

Phương trình của Logistic Map được định nghĩa bằng công thức đệ quy sau:

$$x_{n+1} = r \cdot x_n \cdot (1 - x_n)$$

Trong đó:
- $x_n$: trạng thái của hệ tại bước n (ví dụ: tỉ lệ quần thể so với sức chứa môi trường). 
- $x_{n+1}$ Trạng thái bước tiêp theo.
- $r$: tham số điều khiển.

#### Tính chất
Miền giá trị: 
\begin{equation}
\begin{aligned}
0 \le x_0 \le 1,\qquad
0 \le r \le 4
\quad\Longrightarrow\quad
0 \le x_n \le 1,\qquad
\forall n.
\end{aligned}
\end{equation}

đạo hàm: 
\begin{equation}
f'(x)=r(1-2x).
\end{equation}

Một điểm cố định ổn định nếu

\begin{equation}
\left|f'(x)\right|<1.
\end{equation}


- (0<r<1): hội tụ về (0).
- (1<r<3): hội tụ về $(1-\dfrac{1}{r})$.
- (r>3): bắt đầu mất ổn định.

Các bạn muốn biết thêm thì có thể xem ở wiki và hơn hết thì ở blog này mình chỉ tập chung là r >3 (trong chall bảo thế :)))) ). 

#### r > 3 Hỗn loạn 
> https://en.wikipedia.org/wiki/Logistic_map#Characterization_of_the_logistic_map
> 
$$
r>3.5699456...
$$

hệ bắt đầu bước vào vùng hỗn loạn.

Lúc này:

- không hội tụ
- không chu kỳ đơn giản
- rất nhạy với điều kiện ban đầu

Và nhìn vào đoạn này: 
![image](https://hackmd.io/_uploads/HJNF_Txmze.png)

Tức là nếu r gần với 3,678..., x gần với 0,728 và x = 1- 1/r. Hai dải hỗn loạn của biểu đồ phân nhánh giao nhau tại điểm [Misiurewicz](https://en.wikipedia.org/wiki/Misiurewicz_point) đầu tiên đối với bản đồ logistic. Nó thỏa mãn các phương trình: 

\begin{equation}
r^3 - 2r^2 - 4r - 8 = 0
\end{equation}

Ở vùng này có điều gì đặc biệt: 
![image](https://hackmd.io/_uploads/SJdzqpeXfl.png)

Như ta có thể thấy được khi vào vùng gần r = 3,678... thì lúc này, tại giá trị r gần vùng này, attractor có dạng hai dải hỗn loạn trên biểu đồ phân nhánh, một cái đi lên 1 cái đi xuống và hội tụ về 1 miền: 
Ta xét: 
1. Vùng cao: 


\begin{aligned}
f(x_{n}) &> x_n\\
&\Longleftrightarrow r x_{n}(1-x_{n}) > x_n\\
&\Longleftrightarrow 1-x_{n} > \frac{1}{r}\\
&\Longleftrightarrow x_{n} < 1-\frac{1}{r}\\
&\Longrightarrow x_{n} < 0.72802197
\end{aligned}

![image](https://hackmd.io/_uploads/ByvjA6g7Gl.png)

Tức là với giá trị x_n < 0.72802197 thì mình sẽ có là f(x_n)> x_n.
và tỷ lệ để x_n < 0,72... là 72 phần trăm chắc v ... 

2. Vùng thấp

tương tự..., tại mình không có quan tâm lắm mình coi vùng cao thôi :))) 

### solve 

#### Math
như ta dễ thấy nhất thì: 
```py!
class PRNG:
    r = 0
    x = 0
    ct = 0
    
    def __init__(self, r, x):
        self.r = r
        self.x = x
        
        for i in range(1000):
            self.step()
            
    def step(self):
        self.x = self.r * self.x * (1-self.x)
        self.ct += 1
        
    def generate(self):
        while self.ct <= 3000:
            self.step()
            byte = int(self.x * 256)
            yield byte


RR = 3.676 + random.random() * 0.000767676767

RR = float("%.15f"%RR)

start = random.random()
p = PRNG(RR, start)

```

ở khởi tạo ta có như trên. thì vấn đề là ta sẽ được in ra : 

```
byte = x * 256 với x thuộc khoảng 0 - 1 
```

một tính chất đặc biết ở hàm int(), nó sẽ làm tròn xuống: 
https://stackoverflow.com/questions/79417379/can-you-explain-how-int-functionint-works-in-python

tức  là ví dụ 2.05 -> 2 . 

vậy ta nhận xét được điều gì??? 

Nếu ta gửi payload một giá trị `b'\0` thì nhận được: 

\begin{aligned}
b_i &= c_i \oplus key_i\\
b_i &= \left\lfloor 256x_n \right\rfloor\\
&\Longleftrightarrow b_i \le 256x_n < b_i + 1\\
&\Longleftrightarrow \frac{b_i}{256} \le x_n < \frac{b_i+1}{256}\\
&\Longleftrightarrow i_{\min} \le x_n < i_{\max}\\
&\Rightarrow min(f(i_{min}),f(i_{max}))\le f(x_n) < max(f(i_{max}),f(i_{max}))
\end{aligned}


tại sao lại có tìm min max trong công thức như thế, nhìn vào đây: 
![image](https://hackmd.io/_uploads/HJ_q4AlmMg.png)

đây là một đồ thị parabol: 
![image](https://hackmd.io/_uploads/rkP0VRl7fl.png)

nên giá trị nó không đồng biến hay nghịch biến, hình như nó biến thiên theo điểm thì phải :)))) 



#### Solve

Và khi ta kết hợp 2 thứ lại ( về logistic map và int ) thì ta có một attack vector như sau: 

đầu tiên: 
- chúng ta sẽ tìm giá trị: 

\begin{aligned}
f_{min}(x) \ f_{max}(x) \leftarrow x_n, \ x_{n+1}
\end{aligned}

như ta đã phân tích ta sẽ sẽ miền Vùng Cao thôi: 

\begin{array}
\ &f(x_{n}) > x_n\\
&\Longleftrightarrow
\left\{
\begin{aligned}
{\min}(x_{n+1})< f_{\max}(x_{n})\\
{\max}(x_{n+1}) &< f_{\min}(x_n) 
\end{aligned}
\right.\Longrightarrow \text{Sai}
\end{array}


Và hơn hết ta chỉ biết được x_n khi và chỉ khi biết dược key_i, nên mình có một ý nghĩ là brute theo dạng tìm key_i nào rồi chúng ta sẽ áp dụng điều kiện trên nếu đúng thì chúng ta đúng key_i. 

solve: 

:::spoiler
```py!

import random
from itertools import cycle
import copy 
from pwn import * 
from Crypto.Util.number import * 
FLAG = "grey{REDACTED}"


"""


equation = -rx^2 + rx ( negative parabol )
f(x_n) > x_n)
=> r * x_n * (1 - x_n) > x_n 
=> r  * (1 - x_n) > 1 
=> x_n< 1 - 1/r 

c[i] xor key[i] = xn * 256  <--   imin = ( c[i] xor key[i] ) / 256  <= xn < imax = ( c[i] xor key[i] ) + 1 / 256 
c[i+1] = xn+1 xor key[i+1]

f(x) = r * x * (1-x)

value min = f(imin) 
value max = f(max)



r in { 3.676 ,  3.676767676767 }
x in {0,1}
low , high 


""" 

# context.log_level = "debug"
# context.log_level = "info"


def f_x(x, r):
    return r * x * (1 - x)


def cal(imin, imax, r):
    vmin = f_x(imin, r)
    vmax = f_x(imax, r)

    fmin = min(vmin, vmax)
    fmax = max(vmin, vmax)

    if imin <= 0.5 <= imax:
        fmax = f_x(0.5, r)

    return fmin, fmax


def caln(imin, imax, r, n):
    for i in range(n):
        imin, imax = cal(imin, imax, r)
    return imin, imax


io = process(["python3", "server.py"])
s = (io.recvline().strip())
# print(s)

r = float(io.recvline().strip())
# print( r)


def send_line(n=1):
    io.sendlineafter(b": ", b"00"*n)
    line = io.recvline().strip().decode()
    if "stop hacking" in line:
        print(io.recvall().decode())
        exit(0)
    return bytes.fromhex(line)


c = [(send_line(2)) for _ in range(30)]
# print(c)
sec = []
# exit(0)


for g0 in range(256):
    for g1 in range(256):
        tmp = True
        for j in range(len(c)):
            c1 = c[j]
            p0 = bytes_to_long(xor(c1[0], g0))
            p1 = bytes_to_long(xor(c1[1], g1))
            # print(p1,p0)
            tmpmin = p0 / 256
            tmpmax = (p0+1) / 256
            fmin, fmax = cal(tmpmin, tmpmax, r)
            tmpmin = p1/256
            tmpmax = (p1+1)/256
            if fmax< tmpmin or fmin > tmpmax:
                tmp = False
                break
        if tmp:
            sec.append(g0)
            sec.append(g1)
            break
    if len(sec) >= 2:
        break

print(sec)
for m in range(2, 16):
    cand = list(range(256))
    while len(cand) > 1:
        res = send_line(m + 1)
        tmp = []

        for k in cand:
            ok = True
            p0 = bytes_to_long (xor(res[0], sec[0]))
            imin = p0 / 256
            imax = (p0+1) / 256
            for j in range(1, m):
                fmin, fmax = cal(imin, imax, r)
                p1 = bytes_to_long(xor(res[j], sec[j]))
                tmpmin = p1/256
                tmpmax = (p1+1)/256
                if fmax< tmpmin or fmin > tmpmax:
                    ok = False
                    break
                imin = max(fmin, tmpmin)
                imax = min(fmax, tmpmax)
            if not ok:
                continue
            fmin, fmax = cal(imin, imax, r)
            p1 = bytes_to_long(xor(res[m], k))
            tmpmin = p1/256
            tmpmax = (p1+1)/256
            if not (fmax< tmpmin or fmin > tmpmax):
                tmp.append(k)
        cand = tmp
    sec.append(cand[0])

sec = bytes(sec)
print(sec)
io.sendlineafter(b": ", sec.hex().encode())
print(io.recvall().decode())
```
