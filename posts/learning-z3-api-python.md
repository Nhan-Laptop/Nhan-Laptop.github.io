# Z3 API trong Python

> Nhan_laptop |
> ---

> Blog này sẽ hướng dẫn một cách tổng quan về Z3Py: Z3 API ở Python.
> Main resource: [Z3 Guide](https://microsoft.github.io/z3guide/programming/Z3%20Python%20-%20Readonly/Introduction/#boolean-logic)

## Sử dụng Z3Py cục bộ

Syntax:

```bash
pip install z3-solver
```

## Mở đầu

Ví dụ 1:

```python
x = Int('x')
y = Int('y')
solve(x > 2, y < 10, x + 2*y == 7)
```

- Kết quả: `[y = 0, x = 7]`

Hàm `Int('x')` tạo ra một biến số nguyên trong Z3 có tên là `x`. Hàm `solve` sẽ giải quyết một hệ thống các ràng buộc. Với ví dụ trên ta sử dụng 2 biến `x` và `y`, và 3 ràng buộc:

- x phải lớn hơn 2.
- y phải bé hơn 10.
- Cuối cùng là tổng giá trị giữa x và 2 lần y phải bằng 7.

Trong phần giải thích toán học, ta có thể viết điều kiện cuối cùng là:

$$
x + 2y = 7
$$

Z3Py như Python sử dụng `=` để gán. Các toán tử `<`, `<=`, `>`, `>=`, `==` và `!=` để so sánh. Ví dụ trên, biểu thức `x + 2*y == 7` là một ràng buộc Z3. Z3 có thể giải và tính toán các công thức.

> Các ví dụ tiếp theo đây sẽ hướng dẫn bạn sử dụng Z3 theo cách đơn giản nhất.

Ví dụ 2:

```python
x = Int('x')
y = Int('y')
print(simplify(x + y + 2*x + 3))
print(simplify(x < y + x + 2))
print(simplify(And(x + 1 >= 3, x**2 + x**2 + y**2 + 2 >= 5)))
```

- Kết quả:

```python
3 + 3*x + y
Not(y <= -2)
And(x >= 2, 2*x**2 + y**2 >= 3)
```

Theo mặc định, Z3Py (dành cho web) hiển thị các công thức và biểu thức bằng kí hiệu toán học. Như thường lệ, $\land$ là logic and, và $\lor$ là logic or, v.v. Lệnh `set_option(html_mode=False)` làm tất cả các công thức và biểu thức được trình bày với ký hiệu Z3Py. Điều này cũng được đặt làm mặc định mode cho bản offline Z3Py với phân phối Z3.

Ví dụ 3:

```python
x = Int('x')
y = Int('y')
print(x**2 + y**2 >= 1)
set_option(html_mode=False)
print(x**2 + y**2 >= 1)
```

- Kết quả:

```python
x**2 + y**2 >= 1
x**2 + y**2 >= 1
```

Ví dụ 4:

```python
x = Int('x')
y = Int('y')
n = x + y >= 3
print("num args: ", n.num_args())
print("children: ", n.children())
print("1st child:", n.arg(0))
print("2nd child:", n.arg(1))
print("operator: ", n.decl())
print("op name:  ", n.decl().name())
```

- Kết quả:

```python
num args:  2
children:  [x + y, 3]
1st child: x + y
2nd child: 3
operator:  >=
op name:   >=
```

Z3 cung cấp đầy đủ những phép toán cơ bản. Z3Py sử dụng tương tự thứ tự ưu tiên toán tử như Python. Như `**` là toán tử mũ. Z3 có thể giải các ràng buộc phi tuyến tính.

Ví dụ 5:

```python
x = Real('x')
y = Real('y')
solve(x**2 + y**2 > 3, x**3 + y < 5)
```

- Kết quả:

```python
[y = 2, x = 0]
```

Hàm `Real('x')` tạo biến giá trị thực x. Z3Py có thể biểu diễn số nguyên lớn tùy ý, số hữu tỉ (như ví dụ trên), và số đại số vô tỷ. Một đại số vô tỷ là một nghiệm của một đa thức hệ số nguyên. Về mặt nội bộ, Z3 biểu diễn chính xác tất cả các số này. Các số vô tỉ được biểu diễn dưới dạng thập phân để dễ đọc kết quả.

Ví dụ 6:

```python
x = Real('x')
y = Real('y')
solve(x**2 + y**2 == 3, x**3 == 2)

set_option(precision=30)
print("Solving, and displaying result with 30 decimal places")
solve(x**2 + y**2 == 3, x**3 == 2)
```

- Kết quả:

```python
[y = -1.1885280594?, x = 1.2599210498?]
Solving, and displaying result with 30 decimal places
[y = -1.188528059421316533710369365015?,
 x = 1.259921049894873164767210607278?]
```

Hàm `set_option` được sử dụng để cấu hình trong môi trường Z3. Nó được sử dụng để thiết lập các tùy chọn cấu hình như hiển thị kết quả. Tùy chọn `set_option(precision=30)` thiết lập số chữ số thập phân để hiển thị kết quả. Dấu `?` trong `1.2599210498?` cho biết đầu ra đã bị cắt bớt.

## Boolean Logic

Z3 hỗ trợ toán tử Boolean: `And`, `Or`, `Not`, `Implies` (implication), `If` (if-then-else). Các hàm ý song phương được biểu diễn bằng phép so sánh `==`.

Ví dụ 1:

```python
p = Bool('p')
q = Bool('q')
r = Bool('r')
solve(Implies(p, q), r == Not(q), Or(Not(p), r))
```

- Kết quả:

```python
[q = True, p = False, r = False]
```

Các hằng Boolean `True` và `False` có thể dùng để xây dựng phương trình Boolean.

Ví dụ 2:

```python
p = Bool('p')
q = Bool('q')
print(And(p, q, True))
print(simplify(And(p, q, True)))
print(simplify(And(p, False)))
```

- Kết quả:

```python
And(p, q, True)
And(p, q)
False
```

Ví dụ 3: sử dụng sự kết hợp giữa đa thức và ràng buộc Boolean.

```python
p = Bool('p')
x = Real('x')
solve(Or(x < 5, x > 10), Or(p, x**2 == 2), Not(p))
```

- Kết quả:

```python
[x = -1.414213562373095048801688724209?, p = False]
```

## Solvers

- Z3 cung cấp cho ta nhiều trình giải khác nhau, như đã được biết ở trên là `solve`. Ở đây sẽ cung cấp cho bạn một cú pháp mới với `Solver()`.

Ví dụ 1:

```python
x = Int('x')
y = Int('y')

s = Solver()
print(s)

s.add(x > 10, y == x + 2)
print(s)
print("Solving constraints in the solver s ...")
print(s.check())

print("Create a new scope...")
s.push()
s.add(y < 11)
print(s)
print("Solving updated set of constraints...")
print(s.check())

print("Restoring state...")
s.pop()
print(s)
print("Solving restored set of constraints...")
print(s.check())
```

- Kết quả:

```python
[]
[x > 10, y == x + 2]
Solving constraints in the solver s ...
Stack (most recent call first):
  File "/lib/python3.12/site-packages/z3/z3core.py", line 4276 in Z3_solver_check_assumptions
  File "/lib/python3.12/site-packages/z3/z3.py", line 7181 in check
  File "<exec>", line 11 in <module>
  File "/lib/python312.zip/_pyodide/_base.py", line 357 in run
  File "/lib/python312.zip/_pyodide/_base.py", line 523 in eval_code
```

Lệnh `Solver()` tạo một solver chung. Các ràng buộc có thể được thêm vào bằng cách sử dụng phương thức `add`. Chúng ta nói rằng các ràng buộc có thể được asserted trong solver. Phương thức `check()` giải các ràng buộc đã được khẳng định. Kết quả là `sat` (satisfiable) nếu một kết quả được tìm thấy. Kết quả trả về `unsat` (ngược lại). Chúng ta có thể nói hệ thống các ràng buộc không thỏa. Cuối cùng solver có thể thất bại trong việc giải và trả về `unknown`.

Một số ứng dụng, chúng ta muốn giải quyết nhiều bài toán giống nhau với vài ràng buộc. Chúng ta sử dụng lệnh `push` và `pop` để làm điều này. Mỗi solver giữ một ngăn của các assertions. Lệnh `push` tạo một phạm vi bằng cách lưu kích thước ngăn xếp hiện tại. Lệnh `pop` xóa mọi assertion đã thực hiện giữa nó và lệnh `push` tương ứng. Lệnh `check` luôn luôn hoạt động trên nội dung của ngăn xếp solver assertion.

Ví dụ 2: đây là ví dụ cho thấy rằng Z3 không thể giải. Z3 có thể giải được các bài toán phi tuyến tính nhưng `2**x` không phải là một đa thức.

```python
x = Real('x')
s = Solver()
s.add(2**x == 3)
print(s.check())
```

- Kết quả:

```python
Stack (most recent call first):
  File "/lib/python3.12/site-packages/z3/z3core.py", line 4276 in Z3_solver_check_assumptions
  File "/lib/python3.12/site-packages/z3/z3.py", line 7181 in check
  File "<exec>", line 5 in <module>
  File "/lib/python312.zip/_pyodide/_base.py", line 357 in run
  File "/lib/python312.zip/_pyodide/_base.py", line 523 in eval_code
```

Ví dụ 3: ví dụ thấy cách duyệt các ràng buộc vào solver, và cách thu thập các số liệu cho `check`.

```python
x = Real('x')
y = Real('y')
s = Solver()
s.add(x > 1, y > 1, Or(x + y > 3, x - y < 2))
print("asserted constraints...")
for c in s.assertions():
    print(c)

print(s.check())
print("statistics for the last check method...")
print(s.statistics())
# Traversing statistics
for k, v in s.statistics():
    print(k, " : ", v)
```

- Kết quả:

```python
asserted constraints...
x > 1
y > 1
Or(x + y > 3, x - y < 2)
sat
statistics for the last check method...
(:arith-lower         1
 :arith-make-feasible 3
 :arith-max-columns   8
 :arith-max-rows      2
 :arith-upper         3
 :decisions           2
 :final-checks        1
 :max-memory          8.91
 :memory              8.65
 :mk-bool-var         4
 :mk-clause-binary    1
 :num-allocs          3055
 :num-checks          1
 :rlimit-count        357
 :time                0.01)
decisions  :  2
final checks  :  1
mk clause binary  :  1
num checks  :  1
mk bool var  :  4
arith-lower  :  1
arith-upper  :  3
arith-make-feasible  :  3
arith-max-columns  :  8
arith-max-rows  :  2
num allocs  :  3067
rlimit count  :  357
max memory  :  8.91
memory  :  8.65
time  :  0.005
```

Lệnh `check()` trả về `sat` khi Z3 tìm được bất cứ kết quả nào dựa trên các ràng buộc. Chúng ta nói Z3 thỏa mãn các ràng buộc. Chúng ta nói rằng kết quả là một `model` với các tập hợp các ràng buộc. Một `model` là một diễn giải làm cho mỗi ràng buộc được khẳng định là đúng.

Ví dụ 4: cho chúng ta thấy về một phương pháp để kiểm tra các model.

```python
x, y, z = Reals('x y z')
s = Solver()
s.add(x > 1, y > 1, x + y > 3, z - x < 10)
print(s.check())

m = s.model()
print("x = %s" % m[x])

print("traversing model...")
for d in m.decls():
    print("%s = %s" % (d.name(), m[d]))
```

- Kết quả:

```python
sat
x = 3/2
traversing model...
y = 2
x = 3/2
z = 0
```

Biểu thức `m[x]` trả về cách diễn giải x trong model `m`. Biểu thức `"%s = %s" % (d.name(), m[d])` trả về một chuỗi trong đó `%s` đầu tiên được thay thế bằng tên `d` (... `d.name()`), và `%s` tiếp theo cũng như thế.

## Arithmetic

Z3 hỗ trợ các biến thực và biến số nguyên. Chúng có thể được kết hợp theo từng bài toán. Như một ngôn ngữ lập trình, Z3Py sẽ tự động thêm các phép ép buộc để chuyển từ số nguyên sang số thực (nếu cần thiết).

Ví dụ 1:

```python
x = Real('x')
y = Int('y')
a, b, c = Reals('a b c')
s, r = Ints('s r')
print(x + y + 1 + (a + s))
print(ToReal(y) + c)
```

- Kết quả:

```python
x + ToReal(y) + 1 + a + ToReal(s)
ToReal(y) + c
```

Hàm `ToReal` chuyển đổi một biểu thức số nguyên sang biểu thức số thực.

Z3Py hỗ trợ tất cả các phép tính cơ bản.

Ví dụ 2:

```python
a, b, c = Ints('a b c')
d, e = Reals('d e')
solve(a > b + 2,
      a == 2*c + 10,
      c + b <= 1000,
      d >= e)
```

- Kết quả:

```python
[d = 0, b = 0, c = 0, e = 0, a = 10]
```

Lệnh `simplify` áp dụng các biểu thức biến đổi trên biểu thức Z3.

Ví dụ 3:

```python
x, y = Reals('x y')
# Put expression in sum-of-monomials form
t = simplify((x + y)**3, som=True)
print(t)
# Use power operator
t = simplify(t, mul_to_power=True)
print(t)
```

- Kết quả:

```python
x*x*x + 3*x*x*y + 3*x*y*y + y*y*y
x**3 + 3*x**2*y + 3*x*y**2 + y**3
```

## Machine Arithmetic

Ví dụ dưới đây sẽ diễn giải cách tạo biến và hằng số bit-vector. Hàm `BitVec('x',16)` tạo ra một biến bit-vector trong Z3 có tên biến là `x` với 16 bit. Để thuận tiện, các hằng số cũng có thể được tạo thành biểu thức bit-vector trong Z3Py. Hàm `BitVecVal(10,32)` tạo một bit-vector với kích thước 32 lưu trữ giá trị 10.

Ví dụ 1:

```python
x = BitVec('x', 16)
y = BitVec('y', 16)
print(x + 2)
# Internal representation
print((x + 2).sexpr())

# -1 is equal to 65535 for 16-bit integers
print(simplify(x + y - 1))

# Creating bit-vector constants
a = BitVecVal(-1, 16)
b = BitVecVal(65535, 16)
print(simplify(a == b))

a = BitVecVal(-1, 32)
b = BitVecVal(65535, 32)
# -1 is not equal to 65535 for 32-bit integers
print(simplify(a == b))
```

- Kết quả:

```python
x + 2
(bvadd x #x0002)
65535 + x + y
True
False
```

Toán tử `>>` là một phép dịch phải, và ngược lại là `<<`.

Ví dụ 2:

```python
# Create two bit-vectors of size 32
x, y = BitVecs('x y', 32)

solve(x >> 2 == 3)

solve(x << 2 == 3)

solve(x << 2 == 24)
```

- Kết quả:

```python
[x = 12]
no solution
[x = 6]
```

## Functions

Không giống với các ngôn ngữ khác, các hàm có tác dụng phụ hoặc không trả về, các hàm trong Z3 không có tác dụng phụ và là toàn bộ. Được hiểu là, các hàm đó được định nghĩa trên toàn bộ các giá trị đầu vào. Bao gồm các hàm như chia. Z3 dựa trên logic bậc nhất.

Cho một ràng buộc như `x + y > 3`, chúng ta nói rằng các `x` và `y` là các biến.

Để minh họa các hàm và hằng số chưa được diễn giải, chúng ta hãy định nghĩa các giá trị đó `x`, `y`. Cuối cùng, đặt `f` là một hàm chưa được diễn giải nhận một đối số (như sort) nguyên và kết quả là một giá trị số nguyên.

Ví dụ 1:

```python
x = Int('x')
y = Int('y')
f = Function('f', IntSort(), IntSort())
solve(f(f(x)) == x, f(x) == y, x != y)
```

- Kết quả:

```python
[x = 0, y = 1, f = [1 -> 0, else -> 1]]
```

Kết quả với `f` nên được đọc là `f(0)` là 1, `f(1)` là 0, và `f(a)` là 1 với tất cả `a` khác nhau từ 0 đến 1.

Trong Z3, chúng ta cũng có thể đánh giá các biểu thức trong mô hình với một hệ thống ràng buộc.

Ví dụ 2:

```python
x = Int('x')
y = Int('y')
f = Function('f', IntSort(), IntSort())
s = Solver()
s.add(f(f(x)) == x, f(x) == y, x != y)
print(s.check())
m = s.model()
print("f(f(x)) =", m.evaluate(f(f(x))))
print("f(x)    =", m.evaluate(f(x)))
```

- Kết quả:

```python
sat
f(f(x)) = 0
f(x)    = 1
```

## Satisfiability and Validity

Phần này chúng ta có thể nhìn ví dụ dưới để xem một biểu thức có nghiệm không.

```python
def prove(f):
    s = Solver()
    s.add(Not(f))
    if s.check() == unsat:
        print("proved")
    else:
        print("failed to prove")
```

## List Comprehensions

Python hỗ trợ `List Comprehensions`. List Comprehensions cung cấp một cách ngắn gọn tạo các danh sách. Nó cũng được sử dụng để tạo biểu thức Z3 và các bài toán trong Z3Py.

Ví dụ 1:

```python
# Create list [1, ..., 5]
print([x + 1 for x in range(5)])

# Create two lists containing 5 integer variables
X = [Int('x%s' % i) for i in range(5)]
Y = [Int('y%s' % i) for i in range(5)]
print(X)

# Create a list containing X[i]+Y[i]
X_plus_Y = [X[i] + Y[i] for i in range(5)]
print(X_plus_Y)

# Create a list containing X[i] > Y[i]
X_gt_Y = [X[i] > Y[i] for i in range(5)]
print(X_gt_Y)

print(And(X_gt_Y))

# Create a 3x3 "matrix" (list of lists) of integer variables
X = [[Int("x_%s_%s" % (i + 1, j + 1)) for j in range(3)]
     for i in range(3)]
pp(X)
```

- Kết quả:

```python
[1, 2, 3, 4, 5]
[x0, x1, x2, x3, x4]
[x0 + y0, x1 + y1, x2 + y2, x3 + y3, x4 + y4]
[x0 > y0, x1 > y1, x2 > y2, x3 > y3, x4 > y4]
And(x0 > y0, x1 > y1, x2 > y2, x3 > y3, x4 > y4)
[[x_1_1, x_1_2, x_1_3],
 [x_2_1, x_2_2, x_2_3],
 [x_3_1, x_3_2, x_3_3]]
```

Lệnh `pp(x)` giống `print`, nhưng nó sử dụng Z3Py formatter với lists và tuples thay vì Python formatter.

Ví dụ 2:

```python
X = IntVector('x', 5)
Y = RealVector('y', 5)
P = BoolVector('p', 5)
print(X)
print(Y)
print(P)
print([y**2 for y in Y])
print(Sum([y**2 for y in Y]))
```

- Kết quả:

```python
[x__0, x__1, x__2, x__3, x__4]
[y__0, y__1, y__2, y__3, y__4]
[p__0, p__1, p__2, p__3, p__4]
[y__0**2, y__1**2, y__2**2, y__3**2, y__4**2]
y__0**2 + y__1**2 + y__2**2 + y__3**2 + y__4**2
```

Các ví dụ vừa rồi được thực hiện trên Python 3.6.

> Python 3.10 trở lên

Ví dụ:

```python
x = [Int(f'x{i}') for i in range(5)]
# [x0, x1, x2, x3, x4]
```

## Remarks

- Có thể thấy được Z3 rất nhiều ứng dụng và đa dạng hàm hỗ trợ, nhưng hầu như chúng ta chỉ sử dụng một số trong đó.
- Có nhiều bài toán chúng ta có thể sử dụng [Gröbner basis](https://en.wikipedia.org/wiki/Gr%C3%B6bner_basis) thay thế Z3.
- Z3 có thể là một công cụ hiệu quả cho các bài toán cần symbolic, như các bài cryptanalysis.

## Bonus Challenge

### Part2 'L-win' - Crypthack

Chall:

```python
from Crypto.Util.number import bytes_to_long

SECRET_T = [?,?,?,?]
FLAG = b"crypto{????????????????????????????????????????}"
assert len(FLAG) == 48
print(len(bin(bytes_to_long(FLAG))[2:]),16*48)
class LFSR:
    def __init__(self):
        self._s = list(map(int, list("{:0384b}".format(bytes_to_long(FLAG)))))

        for _ in range(16 * len(FLAG)):
            self._clock()


    def _clock(self):
        b = self._s[0]
        c = 0
        for t in SECRET_T: c ^= self._s[t]
        self._s = self._s[1:] + [c]
        return b

    def stream(self, length):
        return [self._clock() for _ in range(length)]

c = LFSR()
stream = c.stream(2048)
print()
print("".join(map(str, stream)))
```

<details>
<summary>Bấm để xem Script Solve (Z3)</summary>

```python
from pwn import *
from Crypto.Util.number import *
from z3 import *

c = '......'
c = list(map(int, c))

taps = [16, 15, 6, 0]

def _clock(_s):
    b = _s[0]
    c = 0
    for t in taps:
        c += _s[t]

    _s = _s[1:] + [c]
    return b, _s


fi = [BitVec(f"x_{i}", 1) for i in range(384)]
s = Solver()

for _ in range(16 * 48):
    b, fi = _clock(fi)

s.add([f == BitVecVal(i, 1) for i, f in zip(c, fi)])

assert s.check() == sat

models = s.model()
fi = [BitVec(f"x_{i}", 1) for i in range(384)]
flag_bit = "".join([str(models[f]) for f in fi])

print(flag_bit)
print(long_to_bytes(int(flag_bit, 2)))
```

</details>

### Cipher - by Giappp

Chall:

```python
import os
from pwn import xor

ROUND = 10
P = [12, 11, 8, 13, 5, 0, 6, 9, 15, 3, 1, 7, 10, 2, 4, 14]
KEY = os.urandom(16)

def pad(state):
    return state + bytes([16 - len(state) % 16]) * (16 - len(state) % 16)

def permute(state):
    new_state = b""
    for i in range(16):
        new_state += bytes([state[P[i]]])
    return new_state

def genroundkey(key):
    while True:
        new = b"\0"
        for i in [4, 2, 0, 6, 9, 14]:
            new = xor(new, key[i])
        key = key[1:] + new
        yield key

def encrypt():
    plaintext = pad(bytes.fromhex(input("Enter your plaintext in hex: ")))
    ciphertext = b""
    gen = genroundkey(KEY)
    for i in range(0, len(plaintext), 16):
        block = plaintext[i:i+16]
        for _ in range(ROUND):
            block = permute(block)
            block = xor(block, next(gen))
        ciphertext += block
    print(ciphertext.hex())

def guess_the_key():
    guess = bytes.fromhex(input("Enter your guess: "))
    if guess == KEY:
        print(open("flag.txt", "r").read())
    else:
        exit(0)

def menu():
    print("""0. Encrypt\n1. Guess the key""")
    return int(input("> "))

while True:
    try:
        choice = [encrypt, guess_the_key]
        option = menu()
        choice[option]()
    except:
        print("Something wrong with your input...")
        exit(0)
```

Mục đích là ta phải tìm lại được key.

<details>
<summary>Bấm để xem Script Solve (Z3)</summary>

```python
import os
from z3 import *
ROUND = 10
P = [12, 11, 8, 13, 5, 0, 6, 9, 15, 3, 1, 7, 10, 2, 4, 14]

Key = [BitVec(f"x_{i}", 8) for i in range(16)]
def pad(state):
    return state + bytes([16 - len(state) % 16]) * (16 - len(state) % 16)

def permute(state):
    new_state = []
    for i in range(16):
        new_state += [state[P[i]]]
    return new_state

def genroundkey(key):
    while True:
        new = BitVecVal(0, 8)
        for i in [4, 2, 0, 6, 9, 14]:
            new = new ^ key[i]
        key = key[1:] + [new]
        yield key

def XOR(block, key):
    for i in range(16):
        block[i] = block[i] ^ key[i]
    return block

def encrypt():
    plaintext = [BitVecVal(0, 8) for i in range(16)]
    ciphertext = b""
    gen = genroundkey(Key)
    for i in range(0, len(plaintext), 16):
        block = plaintext[i:i+16]
        for _ in range(ROUND):
            block = permute(block)
            block = XOR(block, next(gen))
        ciphertext = block
    return ciphertext

Key = encrypt()
from pwn import *

p = process(["python3.10", "chall.py"])

def send0():
    pay = b'\0'*16
    p.recvuntil('> ')
    p.sendline('0')
    p.recvuntil("Enter your plaintext in hex: ")
    p.sendline(pay.hex())
    p.recvuntil("ciphertext")
    resp = p.recvline().decode().strip()
    return bytes.fromhex(resp)

ciphertext = send0()[:16]

ciphertext = [BitVecVal(ci, 8) for ci in ciphertext]
s = Solver()

for ci, ki in zip(ciphertext, Key):
    s.add(ki == ci)

assert s.check() == sat

key = [BitVec(f"x_{i}", 8) for i in range(16)]

key = [s.model()[ki].as_long() for ki in key]
key = bytes(key)

p.recvuntil("> ")
p.sendline('1')
p.sendlineafter('Enter your guess: ', key.hex())
p.recvuntil("flag")
p.recvline()
```

</details>

Bài này thì mình chia làm 2 phase:

- Phase 1: chúng ta sẽ symbolic toàn bộ các phần mã hóa xem có gì.
- Phase 2: giải thôi.

### Custom chall

Chall:

```python
from Crypto.Util.number import *
import os

flag = b'CUSCTF{???}'

class Cipher:
    def __init__(self, n):
        self.state = n
        self.tap = [[9, 6, 4, 11, 3, 20, 16, 0, 2, 18], [10, 2, 12, 3, 11, 1, 0, 20, 4, 7], [19, 7, 0, 20, 16, 21, 14, 10, 11, 17], [15, 20, 13, 12, 19, 6, 16, 17, 0, 9], [6, 12, 19, 14, 8, 10, 15, 18, 16, 7], [10, 21, 20, 11, 15, 14, 1, 8, 17, 7], [15, 3, 16, 20, 21, 19, 5, 17, 10, 8], [0, 16, 6, 20, 19, 1, 18, 13, 3, 2], [11, 14, 10, 12, 9, 3, 17, 5, 13, 19], [21, 19, 3, 2, 18, 11, 14, 17, 10, 8], [12, 20, 7, 11, 16, 17, 8, 18, 3, 1], [1, 0, 21, 19, 2, 7, 11, 6, 4, 3], [21, 10, 3, 11, 15, 17, 1, 7, 19, 14], [14, 11, 12, 13, 3, 16, 7, 0, 2, 10], [12, 16, 8, 3, 17, 6, 2, 5, 13, 7], [16, 7, 21, 13, 9, 0, 19, 6, 2, 4], [11, 1, 13, 2, 20, 19, 14, 3, 4, 7], [11, 4, 14, 16, 7, 9, 13, 18, 21, 12], [11, 14, 12, 3, 2, 5, 9, 13, 6, 19], [20, 1, 2, 21, 11, 9, 5, 16, 7, 14], [4, 0, 3, 21, 6, 9, 12, 5, 20, 18], [1, 15, 4, 7, 5, 11, 2, 3, 19, 12]]
        self.list_params = self._rebash(n)

    def _rebash(self, n, b=256):
        if n <= 256:
            return [n]
        else:
            return [n % b] + self._rebash(n // b)

    def t2b(self):
        res = []
        for i in self.tap:
            b = 0
            for j in i:
                b = (b + self.list_params[j]) % 256
            self.list_params = self.list_params[1:] + [b]
        return self.list_params

C = Cipher(bytes_to_long(flag))

print(f'list_ciphertext = ', C.t2b())
# list_ciphertext =  [123, 70, 84, 67, 83, 85, 67, 81, 226, 166, 200, 31, 247, 146, 128, 219, 48, 56, 24, 186, 98, 152, 193, 148, 241, 29, 127, 176, 109]
```

Làm thử đi :))))

> Continue...

## References

[1] Wikipedia.
[2] [Z3 Guide](https://microsoft.github.io/z3guide/programming/Z3%20Python%20-%20Readonly/Introduction/#boolean-logic)
[3] AI: Chatgpt.
[4] https://github.com/ViRb3/z3-python-ctf
[5] https://book.jorianwoltjer.com/cryptography/custom-ciphers/z3-solver
[6] https://microsoft.github.io/z3guide/
