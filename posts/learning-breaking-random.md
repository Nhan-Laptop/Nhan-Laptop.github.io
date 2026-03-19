# Breaking Random

> Nhan_laptop |
> --

> Có bao giờ bạn nghĩ mình sẽ đoán được số sẽ được xổ vào ngày mai không ???, hay đơn giản chỉ là đoán được số sẽ được random từ một thư viện ._. ????
>
> Blog này sẽ giới thiệu bạn một số cách để rack random trong một vài thư viện.
> Implement: https://github.com/Nhan-Laptop/Break-random

## Mở Đầu

Chúng ta sẽ bắt đầu với hàm `random` trong Python trước.
Python ngẫu nhiên sử dụng [Mersenne Twister](https://en.wikipedia.org/wiki/Mersenne_Twister). Nếu như có đủ 624 output 32-bit ta sẽ giải quyết được vấn đề!!???

### Mersenne Twister

> Main resource:
> + https://rbtree.blog/posts/2021-05-18-breaking-python-random-module/

Mersenne Twister có 624 số nguyên 32 bit dưới dạng trạng thái và mỗi lần nó xuất ra một số nguyên 32 bit dưới dạng đầu ra và thay đổi trạng thái. [Here](https://github.com/python/cpython/blob/23362f8c301f72bbf261b56e1af93e8c52f5b6cf/Modules/_randommodule.c) miêu tả chi tiết cách hoạt động của MT.

Nếu có 624 đầu ra 32-bit đầy đủ, bạn có thể khôi phục toàn bộ trạng thái -> dự đoán hoàn hảo các số tiếp theo.

Nếu chỉ có đầu ra bị cắt bớt bit (ví dụ `getrandbits(30)`), vẫn có thể khôi phục gần như toàn bộ bằng cách mô hình hóa tuyến tính trên GF(2); đôi khi sẽ còn một vài bit “tự do” không thể suy ra từ các quan sát đó.

```c
/* Period parameters -- These are all magic.  Don't change. */
#define N 624
#define M 397
#define MATRIX_A 0x9908b0dfU    /* constant vector a */
#define UPPER_MASK 0x80000000U  /* most significant w-r bits */
#define LOWER_MASK 0x7fffffffU  /* least significant r bits */

static uint32_t
genrand_uint32(RandomObject *self)
{
    uint32_t y;
    static const uint32_t mag01[2] = {0x0U, MATRIX_A};
    /* mag01[x] = x * MATRIX_A  for x=0,1 */
    uint32_t *mt;

    mt = self->state;
    if (self->index >= N) { /* generate N words at one time */
        int kk;

        for (kk=0;kk<N-M;kk++) {
            y = (mt[kk]&UPPER_MASK)|(mt[kk+1]&LOWER_MASK);
            mt[kk] = mt[kk+M] ^ (y >> 1) ^ mag01[y & 0x1U];
        }
        for (;kk<N-1;kk++) {
            y = (mt[kk]&UPPER_MASK)|(mt[kk+1]&LOWER_MASK);
            mt[kk] = mt[kk+(M-N)] ^ (y >> 1) ^ mag01[y & 0x1U];
        }
        y = (mt[N-1]&UPPER_MASK)|(mt[0]&LOWER_MASK);
        mt[N-1] = mt[M-1] ^ (y >> 1) ^ mag01[y & 0x1U];

        self->index = 0;
    }

    y = mt[self->index++];
    y ^= (y >> 11);
    y ^= (y << 7) & 0x9d2c5680U;
    y ^= (y << 15) & 0xefc60000U;
    y ^= (y >> 18);
    return y;
}
```

**Remarks:**

- `self->index` được tăng thêm 1 mỗi khi nó được gọi. Nếu nó lớn hơn, nó sẽ thay đổi trạng thái hiện tại sang trạng thái tiếp theo: `self->index >= N`.
- `mt[self->index++]` để xuất ra nó.
- Quá trình thay đổi trạng thái: mỗi `kk` tương ứng lấy
  `y = (mt[kk] & UPPER_MASK) | (mt[(kk + 1) % N] & LOWER_MASK)`
  `mt[kk] = mt[(kk + M) % N] ^ (y >> 1) ^ mag01[y & 0x1U]`.
- Ta thấy `y` bị biến đổi khá là nhiều.

```c
Temper:
 y = mt[self->index++];
    y ^= (y >> 11);
    y ^= (y << 7) & 0x9d2c5680U;
    y ^= (y << 15) & 0xefc60000U;
    y ^= (y >> 18);
```

Nhưng bản chất vẫn chỉ là các phép biến đổi Temper, nếu ta recover được state từ bước này thì hiển nhiên ta sẽ đoán được phía sau mà thôi.

### Khôi phục từ đầu ra đầy đủ 32 bit

```c
// https://rbtree.blog/posts/2021-05-18-breaking-python-random-module/

TemperingMaskB = 0x9d2c5680
TemperingMaskC = 0xefc60000

def untemper(y):
    y = undoTemperShiftL(y)
    y = undoTemperShiftT(y)
    y = undoTemperShiftS(y)
    y = undoTemperShiftU(y)
    return y

def undoTemperShiftL(y):
    last14 = y >> 18
    final = y ^ last14
    return final

def undoTemperShiftT(y):
    first17 = y << 15
    final = y ^ (first17 & TemperingMaskC)
    return final

def undoTemperShiftS(y):
    a = y << 7
    b = y ^ (a & TemperingMaskB)
    c = b << 7
    d = y ^ (c & TemperingMaskB)
    e = d << 7
    f = y ^ (e & TemperingMaskB)
    g = f << 7
    h = y ^ (g & TemperingMaskB)
    i = h << 7
    final = y ^ (i & TemperingMaskB)
    return final

def undoTemperShiftU(y):
    a = y >> 11
    b = y ^ a
    c = b >> 11
    final = y ^ c
    return final
```

Temper là chuỗi phép dịch bit và XOR (có thêm AND với mặt nạ ở bước trái). Các phép này có thể đảo (un-temper) từng bước nếu làm theo đúng thứ tự và hướng bit phù hợp.

Khi đã “un-temper” đủ 624 giá trị 32-bit liên tiếp, ta thu lại đúng 624 phần tử trạng thái (với `index=0`), rồi nạp lại vào Python qua `random.setstate(...)`.

Bạn có thể kiểm chứng:

```python
import random

# Lấy nhiều đầu ra 32-bit đầy đủ
outs = [random.getrandbits(32) for _ in range(1000)]

# Dựng lại state từ 624 đầu ra đầu tiên
state_words = [untemper(v) for v in outs[:624]]
restored = (3, tuple(state_words + [0]), None)

random.setstate(restored)
for i in range(1000):
    assert outs[i] == random.getrandbits(32)
```

Vấn đề về thu thập đủ 32 bit gần như đã được hoàn thành.

Vậy nếu các bit đầu ra không đầy đủ như điều kiện thì sao????

### Khôi phục từ đầu ra một phần

Như đã đề cập ở phần cuối về bit, ví dụ: `python.getrandbits(30)`.

Với `k <= 32`, Python chỉ trả về k bit cao của giá trị sau temper. Vì vậy, nếu gọi `getrandbits(30)`, 2 bit thấp nhất của mỗi giá trị 32-bit không được quan sát.

```c
static PyObject *
_random_Random_getrandbits_impl(RandomObject *self, int k)
/*[clinic end generated code: output=b402f82a2158887f input=8c0e6396dd176fc0]*/
{
    int i, words;
    uint32_t r;
    uint32_t *wordarray;
    PyObject *result;

    if (k < 0) {
        PyErr_SetString(PyExc_ValueError,
                        "number of bits must be non-negative");
        return NULL;
    }

    if (k == 0)
        return PyLong_FromLong(0);

    if (k <= 32)  /* Fast path */
        return PyLong_FromUnsignedLong(genrand_uint32(self) >> (32 - k));

    words = (k - 1) / 32 + 1;
    wordarray = (uint32_t *)PyMem_Malloc(words * 4);
    if (wordarray == NULL) {
        PyErr_NoMemory();
        return NULL;
    }

    /* Fill-out bits of long integer, by 32-bit words, from least significant
       to most significant. */
#if PY_LITTLE_ENDIAN
    for (i = 0; i < words; i++, k -= 32)
#else
    for (i = words - 1; i >= 0; i--, k -= 32)
#endif
    {
        r = genrand_uint32(self);
        if (k < 32)
            r >>= (32 - k);  /* Drop least significant bits */
        wordarray[i] = r;
    }

    result = _PyLong_FromByteArray((unsigned char *)wordarray, words * 4,
                                   PY_LITTLE_ENDIAN, 0 /* unsigned */);
    PyMem_Free(wordarray);
    return result;
}
```

Dù thu thập rất nhiều đầu ra (hàng nghìn lần gọi), sẽ có trường hợp một (vài) bit của trạng thái không ảnh hưởng đến bất kỳ bit quan sát được nào => bit “tự do” không thể suy ra.

```c
#define MATRIX_A 0x9908b0dfU    /* constant vector a */
#define UPPER_MASK 0x80000000U  /* most significant w-r bits */
#define LOWER_MASK 0x7fffffffU  /* least significant r bits */
```

MT19937 và temper là tuyến tính theo XOR (trên GF(2)).

Ta có thể theo dõi lan truyền của từng bit trạng thái bằng cách thay vì giữ số nguyên, ta giữ một vector cơ sở 19968-bit (biểu diễn bằng bitmask Python int), sau đó áp dụng đúng các phép twist và temper nhưng ở dạng tuyến tính trên bitmask.

Mỗi bit đầu ra quan sát được tạo thành một phương trình tuyến tính với 19968 ẩn (các bit trạng thái). Gom đủ phương trình => giải bằng khử Gauss (bitset) trên GF(2).

### Implementation

Twisted.py:

```python
ITW = 32
N = 624
M = 397
A = 0x9908B0DF
UPPER = 0x80000000
LOWER = 0x7FFFFFFF

class Twister:
    """Theo dõi ảnh hưởng của từng bit trạng thái dưới dạng bitmask."""
    def __init__(self):
        self.state = [ [(1 << (32*i + (31-b))) for b in range(32)] for i in range(N) ]
        self.idx = 0

    @staticmethod
    def _xor(a, b):
        return [x ^ y for x, y in zip(a, b)]

    @staticmethod
    def _and_mask(bits, mask):
        return [bm if ((mask >> (31 - i)) & 1) else 0 for i, bm in enumerate(bits)]

    def _twist_once(self):
        mt = self.state
        if self.idx >= N:
            for k in range(N):
                k1 = (k + 1) % N
                km = (k + M) % N
                y = [ (mt[k][0] & UPPER) | (mt[k1][0] & LOWER) ] + mt[k][1:]
                y_sh = [0] + y[:-1]
                mag = [0]*32
                if (y[-1] & 1):
                    mag = self._and_mask([y_sh[0]] + y_sh[1:], A)
                mt[k] = self._xor(mt[km], self._xor(y_sh, mag))
            self.idx = 0

    def _temper_bits(self, bits):
        y = bits[:]
        y = [ y[i] ^ (y[i-11] if i>=11 else 0) for i in range(32) ]
        t = [ (y[i+7] if i<=24 else 0) for i in range(32) ]
        t = self._and_mask(t, MASK_B)
        y = [ y[i] ^ t[i] for i in range(32) ]
        t = [ (y[i+15] if i<=16 else 0) for i in range(32) ]
        t = self._and_mask(t, MASK_C)
        y = [ y[i] ^ t[i] for i in range(32) ]
        y = [ y[i] ^ (y[i-18] if i>=18 else 0) for i in range(32) ]
        return y

    def gen_word_masks(self):
        self._twist_once()
        masks = self._temper_bits(self.state[self.idx])
        self.idx += 1
        return masks

    def getrandbits_masks(self, k):
        if k <= 32:
            masks = self.gen_word_masks()
            return masks[:k]
        bits = []
        while k > 0:
            masks = self.gen_word_masks()
            take = min(32, k)
            if take < 32:
                masks = masks[:take]
            bits = masks[:take] + bits
            k -= take
        return bits
```

Solver():

```python
class Solver:
    def __init__(self):
        self.eq = []
        self.bs = []

    def add(self, mask: int, bit: int):
        m, b = mask, bit & 1
        i = 0
        while i < len(self.eq) and m:
            lsb = self.eq[i] & -self.eq[i]
            if m & lsb:
                m ^= self.eq[i]
                b ^= self.bs[i]
            i += 1
        if m:
            self.eq.append(m)
            self.bs.append(b)

    def solve_any(self) -> int:
        x = 0
        for m, b in zip(self.eq, self.bs):
            if b:
                x ^= (m & -m)
        return x
```

Kết quả: với khoảng 1247 lần gọi `getrandbits(30)`, hệ phương trình đủ để phục hồi 19967/19968 bit trạng thái — tức thiếu đúng 1 bit (một biến tự do). Việc đặt biến tự do đó là 0 (hay 1) không ảnh hưởng đến chuỗi bit đã quan sát (và một đoạn đáng kể sau đó), nên bạn vẫn đồng bộ được với bộ sinh của đối phương và dự đoán tiếp.

Việc này đã được tác giả trong bài viết chỉnh sửa bằng:

```text
Chúng tôi đã dành rất nhiều thời gian để xác minh phần này, nhưng cuối cùng, chúng tôi có thể kết luận rằng phần được đề cập thực sự không thể được tìm thấy. Điều này có nghĩa là một bit cụ thể ở trạng thái ban đầu chỉ ảnh hưởng đến một vị trí cụ thể trong đầu ra 32 bit.

Do đó, tôi phải bỏ qua biến tự do và viết lại nó bằng mã giải quyết nó.
```

```python
class Twister:
    N = 624
    M = 397
    A = 0x9908b0df

    def __init__(self):
        self.state = [ [ (1 << (32 * i + (31 - j))) for j in range(32) ] for i in range(624)]
        self.index = 0

    @staticmethod
    def _xor(a, b):
        return [x ^ y for x, y in zip(a, b)]

    @staticmethod
    def _and(a, x):
        return [ v if (x >> (31 - i)) & 1 else 0 for i, v in enumerate(a) ]

    @staticmethod
    def _shiftr(a, x):
        return [0] * x + a[:-x]

    @staticmethod
    def _shiftl(a, x):
        return a[x:] + [0] * x

    def get32bits(self):
        if self.index >= self.N:
            for kk in range(self.N):
                y = self.state[kk][:1] + self.state[(kk + 1) % self.N][1:]
                z = [ y[-1] if (self.A >> (31 - i)) & 1 else 0 for i in range(32) ]
                self.state[kk] = self._xor(self.state[(kk + self.M) % self.N], self._shiftr(y, 1))
                self.state[kk] = self._xor(self.state[kk], z)
            self.index = 0

        y = self.state[self.index]
        y = self._xor(y, self._shiftr(y, 11))
        y = self._xor(y, self._and(self._shiftl(y, 7), 0x9d2c5680))
        y = self._xor(y, self._and(self._shiftl(y, 15), 0xefc60000))
        y = self._xor(y, self._shiftr(y, 18))
        self.index += 1

        return y

    def getrandbits(self, bit):
        return self.get32bits()[:bit]

class Solver:
    def __init__(self):
        self.equations = []
        self.outputs = []

    def insert(self, equation, output):
        for eq, o in zip(self.equations, self.outputs):
            lsb = eq & -eq
            if equation & lsb:
                equation ^= eq
                output ^= o

        if equation == 0:
            return

        lsb = equation & -equation
        for i in range(len(self.equations)):
            if self.equations[i] & lsb:
                self.equations[i] ^= equation
                self.outputs[i] ^= output

        self.equations.append(equation)
        self.outputs.append(output)

    def solve(self):
        num = 0
        for i, eq in enumerate(self.equations):
            if self.outputs[i]:
                # Assume every free variable is 0
                num |= eq & -eq

        state = [ (num >> (32 * i)) & 0xFFFFFFFF for i in range(624) ]
        return state

import random

num = 1247
bit = 30
twister = Twister()
outputs = [ random.getrandbits(bit) for _ in range(num) ]
equations = [ twister.getrandbits(bit) for _ in range(num) ]

solver = Solver()
for i in range(num):
    for j in range(bit):
        print(i, j)
        solver.insert(equations[i][j], (outputs[i] >> (bit - 1 - j)) & 1)

state = solver.solve()
recovered_state = (3, tuple(state + [0]), None)
random.setstate(recovered_state)

for i in range(num):
    assert outputs[i] == random.getrandbits(bit)
```

Vậy nếu với trường hợp `bit truncated` thì phải làm sao, đây là một câu hỏi nhỏ trong đầu:
https://github.com/icemonster/symbolic_mersenne_cracker/blob/main/README.md

Với repo này thì ta có thể solve được trường hợp ở trên.

Ngoài ra còn 1 số cách recover lại state thông qua [Z3 (instructions)](https://hackmd.io/tA80GD-7R4GcmJTPmMPCag), [gf2bv](https://hackmd.io/@ADP/SJ4ceI3pkx?stext=7722%3A2686%3A0%3A1755526394%3AYPXZJJ):
đây là Z3:

```python
from z3 import *

class Break_rand:

    def __init__(self):

        self.output = []

    def untemper(self,output):
        y1 = BitVec('y1', 32)
        y2 = BitVec('y2', 32)
        y3 = BitVec('y3', 32)
        y4 = BitVec('y4', 32)
        y = BitVecVal(output, 32)

        s = Solver()
        equations = [
            y2 == y1 ^ (LShR(y1, 11)),
            y3 == y2 ^ ((y2 << 7) & 0x9D2C5680),
            y4 == y3 ^ ((y3 << 15) & 0xEFC60000),
            y == y4 ^ (LShR(y4, 18))
        ]
        s.add(equations)
        s.check()
        return s.model()[y1].as_long()

    def recover_state_mt(self):
        assert len(self.output)>= 624, "Can not recover state!"
        state = tuple(self.untemper(n)& 0xffffffff  for n in self.output[:624])
        return (3, state + (624,), None)

    def submit(self,n):
        self.output.append(n)

"""
Test function
"""
from random import *

rng = Random()
tmp = []
breakrand = Break_rand()

for i in range(624):
    breakrand.submit(rng.getrandbits(32))

Ran = Random()
Ran.setstate(breakrand.recover_state_mt())

assert Ran.getrandbits(32)==rng.getrandbits(32)
```

## js `Math.random()`

```js
// https://soon.haari.me/import-random/

uint64_t state0, state1;    // the 128-bit state

// update state and produce a double
double MathRandom(void) {
  uint64_t s0 = state1;  // notice the swap
  uint64_t s1 = state0;
  s1 = s1 ^ (s1 << 23);
  s1 = s1 ^ (s1 >> 17) ^ (s0 >> 26) ^ s0;
  state0 = s0;
  state1 = s1;
  if (Firefox || Webkit) // Firefox v47.0, Webkit 2019-07 thru 2020-02
    return (double)( (s0+s1) & (((uint64_t)1<<53)-1) ) / ((uint64_t)1<<53);
  else                   // ChromX V8, 2019-01 thru 2020-02
    return (double)(  s0     >> 12                   ) / ((uint64_t)1<<52);
}
```

Nhìn chung thì với `Math.random()` các biểu thức tạo nên số giả ngẫu nhiên - PRNG có đôi phần đơn giản hơn MT19937, mình có thể hoàn toàn dễ dàng đảo ngược được dựa trên: [Xorshift128](https://en.wikipedia.org/wiki/Xorshift).
Nhưng với trình duyệt `(Firefox || Webkit)`, có thêm phần cộng `s0+s1` trên kiểu `uint64_t`, điều này không dựa trên bit, nên khó đảo ngược.
Nhưng với các trường hợp còn lại - `v8` thì ta có thể đảo ngược lại quá trình này: `(double) s0 >> 12` - làm mất đi 12 bits LSB.
Không hiểu sao mình lại stuck 2 tiếng :)))

## c/c++ `rand()`

> Main resource:
> + https://www.mscs.dal.ca/~selinger/random/

![image](https://hackmd.io/_uploads/H1CO-_bFxx.png)

```c
#include <stdio.h>

#define MAX 1000
#define seed 1

main() {
  int r[MAX];
  int i;

  r[0] = seed;
  for (i=1; i<31; i++) {
    r[i] = (16807LL * r[i-1]) % 2147483647;
    if (r[i] < 0) {
      r[i] += 2147483647;
    }
  }
  for (i=31; i<34; i++) {
    r[i] = r[i-31];
  }
  for (i=34; i<344; i++) {
    r[i] = r[i-31] + r[i-3];
  }
  for (i=344; i<MAX; i++) {
    r[i] = r[i-31] + r[i-3];
    printf("%d\n", ((unsigned int)r[i]) >> 1);
  }
}
```

**Remarks:**

- Các phép toán biến đổi tuyến tính trên `2147483647 = 2^31 - 1`.
- `r[0]` chính là seed, vì seed chỉ có 32-bit, nên ta có thể hoàn toàn bruteforce được.
- Phép nhân với `16807LL` có dấu được thực hiện để kết quả đủ lớn, tránh tràn trước khi modulo.

Hoàn thành xong các bước khởi tạo:

```c
for (i=34; i<344; i++) {
    r[i] = r[i-31] + r[i-3];
}
```

chạy Additive large Fibonacci:

$$
r[i] \equiv r[i-3] + r[i-31] \pmod{2^{32}}
$$

- Giá trị trả về là 31-bit dương: $out_i = (r[i] >> 1)$ - lấy 31 bit cao, bỏ đi LSB.

### Phá vỡ tuyến tính

Ta cần ít nhất 63 output liên tiếp để recover lại trạng thái ban đầu: `r[i-3] ... r[i-31]` phương trình 2 ẩn (ý mình là 2 ẩn này hông liên quan, nhưng thật chất thì có thể 32 phương trình là được). Nhưng ta có được hẳn: `999 - 344` trạng thái 31-bit MSB, nên dễ dàng cho việc recover.

Chiến thuật là:

- Ta cần recover lại được các bit LSB.
- Sau đó là lùi về trạng thái ban đầu.

### Phase 1: Khôi phục LSB

Đầu tiên ta nên liệt kê ra các trạng thái - ở dạng đơn giản với 2 bit mỗi loại:

```python
    i-3   i-31     i
    00    00        00
    00    01        01  <-------
    00    10        10
    00    11        11  <-------
    01    00        01  <-------
    01    01        10
    01    10        11  <-------
    01    11        00
    10    00        10
    10    01        11  <-------
    10    10        00
    10    11        01  <-------
    11    00        11  <-------
    11    01        00
    11    10        01  <-------
    11    11        00
```

Mình đánh dấu lại trạng thái LSB bằng 1 của i.
Tiếp theo là tìm điểm khác biệt:

```python
    i-3   i-31     i
    00    00        00 == 00    01        01
    00    01        01 == 00    00        00 <-------
    00    10        10 == 00    11        11
    00    11        11 == 00    10        10 <-------
    01    00        01 == 00    00        00 <-------
    01    01        10
    01    10        11 == 00    10        10 <-------
    01    11        00
    10    00        10 == 10    01        11
    10    01        11 == 10    00        10 <-------
    10    10        00 == 10    11        01
    10    11        01 == 10    10        00 <-------
    11    00        11 == 10    00        10 <-------
    11    01        00
    11    10        01 == 10    10        00 <-------
    11    11        00 == 11    10        01
```

:))) nó hum ra gì để có thể xác minh `LSB = 1`.
Nhưng đổi lại ta có được vài trạng thái `LSB = 0`:

```python
    i-3   i-31      i
    01    01        10
    01    11        00
    11    01        00
```

Quy tắc loại của mình là: ta tập trung vào MSB của các số ví dụ, nếu có loại trùng thì ta loại ra khỏi danh sách, và cuối cùng được 3 mẫu.

Sau khi mình tìm ra được 1 khoảng các số thỏa mãn rồi thì bây giờ:

```python
"""
    i-3   i-31      i
    01    01        10
    01    11        00
    11    01        00
"""
while index -31 >= 344 :

    if fre[index] == 0:

        x = output[ index - 3  ]
        y = output[ index - 31 ]
        z = output[ index      ]
        xbit = bin(x)[-1]
        ybit = bin(y)[-1]
        zbit = bin(z)[-1]
        if ( xbit == '0' and ybit == '0' and zbit =='1' and
            fre[index]==0 and fre[index-3]==0 and fre[index - 31]==0 ):
                    if fre[index]==0:
                        output[index]   = (output[index] * 2) % 2**32
                        fre[index]=1


                    if fre[index-3]  ==0 :
                        output[index-3] = (output[index - 3]* 2 + 1) %2**32
                        fre[index-3] = 1

                    if fre[index-31] ==0 :
                        output[index-31]= (output[index - 31]* 2 + 1) % 2**32
                        fre[index-31]= 1

                    fre[index] = 1

                    assert output[index   ] == tmp[index]
                    assert output[index-3 ] == tmp[index-3]
                    assert output[index-31] == tmp[index-31]

        if ( xbit == '0' and ybit == '1' and zbit =='0'
            and fre[index]==0 and fre[index-3]==0 and fre[index - 31]==0 ):
                    if fre[index]==0:
                        output[index]   = (output[index] * 2) % 2**32
                        fre[index]=1


                    if fre[index-3]  ==0 :
                        output[index-3] = (output[index - 3]* 2 + 1) %2**32
                        fre[index-3] = 1

                    if fre[index-31] ==0 :
                        output[index-31]= (output[index - 31]* 2 + 1) % 2**32
                        fre[index-31]= 1

                    fre[index] = 1

                    assert output[index   ] == tmp[index]
                    assert output[index-3 ] == tmp[index-3]
                    assert output[index-31] == tmp[index-31]

        if ( xbit == '1' and ybit == '0' and zbit =='0'
            and fre[index]==0 and fre[index-3]==0 and fre[index - 31]==0 ):
                    if fre[index] == 0:
                        output[index]   = (output[index] * 2) % 2**32
                        fre[index]=1

                    if fre[index-3]  ==0 :
                        output[index-3] = (output[index - 3]* 2 + 1) %2**32
                        fre[index-3] = 1

                    if fre[index-31] ==0 :
                        output[index-31]= (output[index - 31]* 2 + 1) % 2**32
                        fre[index-31]= 1

                    fre[index] = 1

                    assert output[index   ] == tmp[index]
                    assert output[index-3 ] == tmp[index-3]
                    assert output[index-31] == tmp[index-31]

    index -= 1


check = 1
while check:
    check = 0
    for i in range(344,MAX):
        if fre[ i - 31 ] and fre[ i - 3 ]==0 and fre[i]  :
            fre[i - 3]= 1
            check = 1
            output[i-3] = (output[i]-output[i - 31]) % 2**32
            assert output[i-3]==tmp[i-3]

        if fre[ i - 31 ]==0 and fre[ i - 3 ] and fre[i]  :
            fre[i - 31]= 1
            check = 1
            output[i-31] = (output[i]-output[i - 3]) % 2**32
            assert output[i - 31]==tmp[i-31]

        if fre[ i - 31 ] and fre[ i - 3 ] and fre[i] == 0 :
            fre[i] = 1
            check = 1
            output[i] = (output[i - 3] + output[i - 31])  % 2**32
            assert output[i] == tmp[i]
```

Hmmmmm.... tới đây thì nó đủ rồi....

### Phase 2: Khôi phục seed

Hmmmm, phần này thì bạn có thể làm nhiều cách:

- Khử Gau.
- Sagemath.... mình không làm ra phần này.
- Z3 - mình làm.

```python
from z3 import *

x = [BitVec(f'x_{i}',32) for i in range(31)]
u = x
for i in range(31,34):
    x.append(x[i-31])

for i in range(34,344):
    x.append(x[i-31] + x[i-3])

s = Solver()
for i in range(344,344+80):
    x.append(x[i-31] + x[i-3])
    s.add(x[i] == int(output[i]))
assert s.check() == sat
m = s.model()

print(m[u[0]].as_long())
```

**Remarks:**

Các bạn sẽ khó hiểu làm sao mà mình liệt kê các trạng thái bit-sample rồi recover được LSB, mình làm trên phép toán cộng bình thường -> nên chỗ này sẽ khó hiểu.
Nhưng bản chất thì $\mod 2^{32}$: là $-$ hoặc $+$ $k\cdot 2^{32}$.
Mà $2^{32}$ = `100000000000000000000000000000000` -> nên suy ra các phép LSB nó được bảo toàn -> từ đây ta chỉ viết làm như phân tích trên.

## golang `math/rand`

`Rand.go`: https://cs.opensource.google/go/go/+/refs/tags/go1.24.2:src/math/rand/rand.go

Hmmm golang opensource code - Mình đọc `rand.go - API` một hồi thì thấy là:
Đầu tiên ta nên đọc từ hàm rand trong rand.go:

```go
// Int31n returns, as an int32, a non-negative pseudo-random number in the half-open interval [0,n).
// It panics if n <= 0.
func (r *Rand) Int31n(n int32) int32 {
    if n <= 0 {
        panic("invalid argument to Int31n")
    }
    if n&(n-1) == 0 { // n is power of two, can mask
        return r.Int31() & (n - 1)
    }
    max := int32((1 << 31) - 1 - (1<<31)%uint32(n))
    v := r.Int31()
    for v > max {
        v = r.Int31()
    }
    return v % n
}
```

Sau đó ta truy về hàm `Int31()`:

```go
// Int31 returns a non-negative pseudo-random 31-bit integer as an int32.
func (r *Rand) Int31() int32 { return int32(r.Int63() >> 32) }
```

Thấy nó lấy `r.Int63() >> 32` tức là nó sinh ra số 64 bit rồi nó dịch còn 32 bit.

```go
// Int63 returns a non-negative pseudo-random 63-bit integer as an int64.
func (r *Rand) Int63() int64 { return r.src.Int63() }
```

```go
// A Rand is a source of random numbers.
type Rand struct {
    src Source
    s64 Source64 // non-nil if src is source64

    // readVal contains remainder of 63-bit integer used for bytes
    // generation during most recent Read call.
    // It is saved so next Read call can start where the previous
    // one finished.
    readVal int64
    // readPos indicates the number of low-order bytes of readVal
    // that are still valid.
    readPos int8
}
```

Thấy nó gọi Source.

```go
// A Source represents a source of uniformly-distributed
// pseudo-random int64 values in the range [0, 1<<63).
//
// A Source is not safe for concurrent use by multiple goroutines.
type Source interface {
    Int63() int64
    Seed(seed int64)
}
```

Truy một hồi ta thấy được cái `Int63()`.

```go
// NewSource returns a new pseudo-random [Source] seeded with the given value.
// Unlike the default [Source] used by top-level functions, this source is not
// safe for concurrent use by multiple goroutines.
// The returned [Source] implements [Source64].
func NewSource(seed int64) Source {
    return newSource(seed)
}

func newSource(seed int64) *rngSource {
    var rng rngSource
    rng.Seed(seed)
    return &rng
}
```

Nhìn vào khúc này tiếp theo ta hiểu `Source` implement bằng cách gọi `rng.go` để lấy seed và hiểu thêm được toàn bộ `Source` gọi hàm từ `rng.go` để tạo ra thuật toán PRNG.

rng.go: https://cs.opensource.google/go/go/+/refs/tags/go1.24.2:src/math/rand/rng.go

```go
type rngSource struct {
    tap  int           // index into vec
    feed int           // index into vec
    vec  [rngLen]int64 // current feedback register
}

// seed rng x[n+1] = 48271 * x[n] mod (2**31 - 1)
func seedrand(x int32) int32 {
    const (
        A = 48271
        Q = 44488
        R = 3399
    )

    hi := x / Q
    lo := x % Q
    x = A*lo - R*hi
    if x < 0 {
        x += int32max
    }
    return x
}

// Seed uses the provided seed value to initialize the generator to a deterministic state.
func (rng *rngSource) Seed(seed int64) {
    rng.tap = 0
    rng.feed = rngLen - rngTap

    seed = seed % int32max
    if seed < 0 {
        seed += int32max
    }
    if seed == 0 {
        seed = 89482311
    }

    x := int32(seed)
    for i := -20; i < rngLen; i++ {
        x = seedrand(x)
        if i >= 0 {
            var u int64
            u = int64(x) << 40
            x = seedrand(x)
            u ^= int64(x) << 20
            x = seedrand(x)
            u ^= int64(x)
            u ^= rngCooked[i]
            rng.vec[i] = u
        }
    }
}

// Int63 returns a non-negative pseudo-random 63-bit integer as an int64.
func (rng *rngSource) Int63() int64 {
    return int64(rng.Uint64() & rngMask)
}

// Uint64 returns a non-negative pseudo-random 64-bit integer as a uint64.
func (rng *rngSource) Uint64() uint64 {
    rng.tap--
    if rng.tap < 0 {
        rng.tap += rngLen
    }

    rng.feed--
    if rng.feed < 0 {
        rng.feed += rngLen
    }

    x := rng.vec[rng.feed] + rng.vec[rng.tap]
    rng.vec[rng.feed] = x
    return uint64(x)
}
```

Rồi đây là các hàm chính của `rng.go`.

Bây giờ ta phân tích 2 hàm tạo seed:

```go
func seedrand(x int32) int32 {
    const (
        A = 48271
        Q = 44488
        R = 3399
    )

    hi := x / Q
    lo := x % Q
    x = A*lo - R*hi
    if x < 0 {
        x += int32max
    }
    return x
}

// Seed uses the provided seed value to initialize the generator to a deterministic state.
func (rng *rngSource) Seed(seed int64) {
    rng.tap = 0
    rng.feed = rngLen - rngTap

    seed = seed % int32max
    if seed < 0 {
        seed += int32max
    }
    if seed == 0 {
        seed = 89482311
    }

    x := int32(seed)
    for i := -20; i < rngLen; i++ {
        x = seedrand(x)
        if i >= 0 {
            var u int64
            u = int64(x) << 40
            x = seedrand(x)
            u ^= int64(x) << 20
            x = seedrand(x)
            u ^= int64(x)
            u ^= rngCooked[i]
            rng.vec[i] = u
        }
    }
}
```

Seed: `seed = seed % int32max` là số 32-bit, ta có thể bruteforce.
Nhưng các phép biến đổi seed tuyến tính nên ta có thể truy ngược về được.
Ta sẽ symbolic bằng Z3 rồi giải.
Như flow nãy giờ ta phân tích, ta sẽ symbolic toàn bộ những thứ tạo nên seed để in ra, rồi giải bằng Z3.

## Bash `$RANDOM`

> Main resource:
> + https://github.com/bminor/bash/blob/master/lib/sh/random.c

```c
/* Returns a 32-bit pseudo-random number. */
static u_bits32_t
intrand32 (u_bits32_t last)
{
  /* Minimal Standard generator from
     "Random number generators: good ones are hard to find",
     Park and Miller, Communications of the ACM, vol. 31, no. 10,
     October 1988, p. 1195. Filtered through FreeBSD.

     x(n+1) = 16807 * x(n) mod (m)

     where 16807 == 7^5.

     We split up the calculations to avoid overflow.

     h = last / q; l = last % q; t = a * l - h * r
     m = 2147483647, a = 16807, q = 127773, r = 2836

     There are lots of other combinations of constants to use; look at
     https://www.gnu.org/software/gsl/manual/html_node/Other-random-number-generators.html#Other-random-number-generators */

  bits32_t h, l, t;
  u_bits32_t ret;

  /* Can't seed with 0. */
  ret = (last == 0) ? 123459876 : last;
  h = ret / 127773;
  l = ret % 127773;
  t = 16807 * l - 2836 * h;
  ret = (t < 0) ? t + 0x7fffffff : t;

  return (ret);
}
```

Hmmm cái phần này :)))) quen quen, hơi giống bước khởi tạo của `Crand`.

```c
genseed (void)
{
  struct timeval tv;
  u_bits32_t iv;

  gettimeofday (&tv, NULL);
  iv = (uintptr_t)seedrand;        /* let the compiler truncate */
  iv = tv.tv_sec ^ tv.tv_usec ^ getpid () ^ getppid () ^ current_user.uid ^ iv;
  return (iv);
}
```

Seed được dựa trên thời gian để tạo.

```c
#define BASH_RAND_MAX    32767       /* 0x7fff - 16 bits */

/* Returns a pseudo-random number between 0 and 32767. */
int
brand (void)
{
  unsigned int ret;

  rseed = intrand32 (rseed);
  if (shell_compatibility_level > 50)
    ret = (rseed >> 16) ^ (rseed & 65535);
  else
    ret = rseed;
  return (ret & BASH_RAND_MAX);
}
```

Hàm chính để cho ra giá trị random khi gọi `$RANDOM`.
Vẫn tuyến tính không gì.

```c
/* Set the random number generator seed to SEED. */
void
sbrand (unsigned long seed)
{
  rseed = seed;
  last_random_value = 0;
}

void
seedrand (void)
{
  u_bits32_t iv;

  iv = genseed ();
  sbrand (iv);
}
```

Nó chỉ là tạo lại seed thôi.

```c
#define BASH_RAND32_MAX    0x7fffffff    /* 32 bits */

/* Returns a 32-bit pseudo-random number between 0 and 4294967295. */
static u_bits32_t
brand32 (void)
{
  u_bits32_t ret;

  rseed32 = intrand32 (rseed32);
  return (rseed32 & BASH_RAND32_MAX);
}
```

Tóm lại là ta chỉ thấy nó chỉ là các phép biến đổi tuyến tính, nếu ta có từ 2-3 output thì sẽ khôi phục được.

## References

[0] https://github.com/tvdat20004?tab=repositories
[1] https://hackmd.io/@ADP/SJ4ceI3pkx?stext=7722%3A2686%3A0%3A1755526394%3AYPXZJJ
[2] https://github.com/TACIXAT/XorShift128Plus/blob/master/README
[3] https://github.com/PwnFunction/v8-randomness-predictor/blob/main/main.py
[4] https://github.com/maple3142/gf2bv
[5] https://github.com/anneouyang/MT19937/blob/master/code/implement_mt19937.py
[6] https://giapppp.notion.site/Crack-random-23e6a3e68e0a80a4ba35dc2e4f7f3bb9
[7] https://cs.opensource.google/go/go/+/refs/tags/go1.24.2:src/math/rand/rand.go
[8] https://github.com/bminor/bash/blob/master/lib/sh/random.c#L150

Trong lúc mình làm thì mình có đọc khá nhiều tài liệu nhưng mà quên mất đi link :>>>>
