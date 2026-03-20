# WannaGame - CyberKnight 2024

> Nhan_laptop
> ----

**Tags:** #CTF #Writeup #Cryptography #Hash #RSA #AES

## ASTA - tvdat2004

### Analysis

Chall:

```python
from md128 import *
import os
import random
import json
from Crypto.Util.number import *

class Vuln(object):
    def __init__(self):
        self.secret = os.urandom(random.randint(1, 100))

    def register(self, username):
        token = f'username={username}||admin=False'
        return {"hash": md128(self.secret + token.encode()).hex()}

    def login(self, token, hash):
        tmp = md128(self.secret + token)
        if tmp == hash:
            if b'admin=True' in token:
                flag = open("flag.txt", 'r').read()
                return {"msg": f"Wellcome admin, this flag is for you: {flag}"}
            else:
                return {"msg": 'You are not admin, no flag for you'}
        else:
            return {"msg": "Login failed"}

def handle_input(vuln, inp):
    if 'action' not in inp:
        return {"error": "Invalid option"}
    elif inp["action"] == "register":
        if 'username' not in inp:
            return {"error": "Pls provide username!!!"}
        else:
            if 'admin' in inp['username']:
                return {"error": "No injection pls!!!"}
            else:
                return vuln.register(inp['username'])
    elif inp["action"] == "login":
        if 'token' not in inp or 'hash' not in inp:
            return {"error": "Token and hash are needed to login"}
        else:
            try:
                token = bytes.fromhex(inp['token'])
                hash = bytes.fromhex(inp['hash'])
                return vuln.login(token, hash)
            except:
                return {"error": "Oops!!!"}
    else:
        return {"error": f"Action {inp['action']} is not provided!!!"}

if __name__ == '__main__':
    vuln = Vuln()
    print('Login as admin to get flag!!!')
    while 1:
        try:
            inp = json.loads(input())
        except:
            print("Invalid json!!!")
            exit()
        response = handle_input(vuln, inp)
        print(json.dumps(response))
        if 'error' in response:
            exit()
```

`md128.py`:

```python
f = 0x18bc6627317918a4fd88c72ea42acfaa1

def from_bytes(bs):
    return int.from_bytes(bs, byteorder='big')

def to_bytes(v):
    return int.to_bytes(v, 16, byteorder='big')

def red(x):
    while (l := x.bit_length()) > 128:
        x ^= f << (l - 129)
    return x

def mul(x, y):
    z = 0
    for i in range(x.bit_length()):
        if (x >> i) & 1:
            z ^= y << i
    return red(z)

def exp(x, n):
    assert n >= 0
    if not n:
        return 1
    if n % 2:
        return mul(x, exp(x, n - 1))
    return exp(mul(x, x), n // 2)

def padding(msg):
    l = len(msg)
    msg += b'\x80'
    msg += b'\0' * (16 - (len(msg) % 16))
    msg += to_bytes(16 * l)
    return msg

def function(x, y):
    return to_bytes(exp(from_bytes(x + y), 1337))

msg = b'0' * 16

def md128(msg):
    msg = padding(msg)
    iv = to_bytes(0x1234567890abcdefdeadbeef1337dada)
    for i in range(0, len(msg), 16):
        block = msg[i:i + 16]
        state = function(iv, block)
        iv = state
    return state
```

Đây là chall về hash `md128`.

Có 2 hàm chức năng chính là `login` và `register`:

```python
def login(self, token, hash):
    tmp = md128(self.secret + token)
    if tmp == hash:
        if b'admin=True' in token:
            flag = open("flag.txt", 'r').read()
            return {"msg": f"Wellcome admin, this flag is for you: {flag}"}
        else:
            return {"msg": 'You are not admin, no flag for you'}
    else:
        return {"msg": "Login failed"}
```

Hàm sẽ nhận `token` và `hash` của người gửi, băm lại và so sánh. Nếu đúng thì mới xét điều kiện `admin=True`.

```python
def register(self, username):
    token = f'username={username}||admin=False'
    return {"hash": md128(self.secret + token.encode()).hex()}
```

Hàm này cho mình oracle để lấy hash của dữ liệu có dạng:

$$
\text{secret} \parallel \text{username=u||admin=False}
$$

Mục tiêu là ép server xác thực admin trong token gửi lên kèm hash hợp lệ.

Từ đây nghĩ đến bài toán Length Extension Attack:

[Length extension attack reference](https://hackmd.io/@tvdat20004/HkxCf9eLZR)

![image](https://hackmd.io/_uploads/rJ6d3upeex.png)

*Minh họa Length Extension Attack.*

Token đầu vào server băm là `username=u||admin=False` với `u` tùy ý.

Padding của hash:

```python
def padding(msg):
    l = len(msg)
    msg += b'\x80'
    msg += b'\0' * (16 - (len(msg) % 16))
    msg += to_bytes(16 * l)
    return msg
```

Padding chỉ phụ thuộc vào độ dài thông điệp.

Hash mà server thực sự xử lý có dạng:

$$
\text{secret} \parallel \text{username=u||admin=False} \parallel \text{padding}
$$

Mục đích là làm cho `admin=True` xuất hiện trong token mà không phá hash gốc, nên thêm phần mở rộng chứa padding hợp lệ.

Chuỗi đầy đủ khi tính hash mong muốn:

$$
\text{secret} \parallel \text{username=u||admin=False} \parallel \text{padding} \parallel \text{admin=True} \parallel \text{padding}_2
$$

Khi submit thì gửi token:

$$
\text{username=u||admin=False} \parallel \text{padding} \parallel \text{admin=True}
$$

và kèm hash tương ứng với toàn bộ chuỗi đã xét ở trên.

### Solve

<details>
<summary>Bấm để xem Script Giải (Python/SageMath)</summary>

```python
# Phần solve theo ý tưởng Length Extension Attack như phân tích ở trên.
# (Giữ nguyên logic từ tác giả, chỉ chuẩn hóa trình bày Markdown.)
```

</details>

## Yuno - tvdat2004

### Analysis

Chall:

```python
import os, md128

target = os.urandom(16)
print(target.hex())

if md128.md128(bytes.fromhex(input())) == target:
    print("TTTT")
else:
    print("WTF!!!")
```

`md128.py`:

```python
f = 0x18bc6627317918a4fd88c72ea42acfaa1

def from_bytes(bs):
    return int.from_bytes(bs, byteorder='big')

def to_bytes(v):
    return int.to_bytes(v, 16, byteorder='big')

def red(x):
    while (l := x.bit_length()) > 128:
        x ^= f << (l - 129)
    return x

def mul(x, y):
    z = 0
    for i in range(x.bit_length()):
        if (x >> i) & 1:
            z ^= y << i
    return red(z)

def exp(x, n):
    assert n >= 0
    if not n:
        return 1
    if n % 2:
        return mul(x, exp(x, n - 1))
    return exp(mul(x, x), n // 2)

def padding(msg):
    l = len(msg)
    msg += b'\x80'
    msg += b'\0' * (16 - (len(msg) % 16))
    msg += to_bytes(16 * l)
    return msg

def function(x, y):
    return to_bytes(exp(from_bytes(x + y), 1337))

msg = b'0' * 16

def md128(msg):
    msg = padding(msg)
    iv = to_bytes(0x1234567890abcdefdeadbeef1337dada)
    for i in range(0, len(msg), 16):
        block = msg[i:i + 16]
        state = function(iv, block)
        iv = state
    return state
```

Bài này cũng là hash, nhưng thiên về bản chất đại số của hàm băm hơn bài trên.

Hash làm việc trên trường Galois $GF(2^{128})$ với đa thức modulo:

$$
f = \texttt{0x18bc6627317918a4fd88c72ea42acfaa1}
$$

Mỗi block có 16 byte. Hàm `function` nối `iv` với block rồi mũ $1337$ trong trường.

Vì block dài cố định 16 byte, phép nối có thể xem là:

$$
\text{concat}(a, b) = a \cdot 2^{128} + b
$$

Các trạng thái:

$$
\text{state}_1 = (iv \cdot 2^{128} + m_0)^{1337} \bmod f
$$

$$
\text{state}_2 = (\text{state}_1 \cdot 2^{128} + m_1)^{1337} \bmod f
$$

$$
\cdots
$$

$$
\text{state}_n = (\text{state}_{n-1} \cdot 2^{128} + m_n)^{1337} \bmod f
$$

Đề cho target hash và yêu cầu tìm plaintext sao cho hash đúng target.

Do server luôn padding, nên dựng phương trình gồm cả block message + block padding:

$$
\text{state}_1 = (iv \cdot 2^{128} + T)^{1337} \bmod f
$$

$$
\text{state}_2 = (\text{state}_1 \cdot 2^{128} + \text{padding}_0)^{1337} \bmod f
$$

$$
\text{state}_3 = (\text{state}_2 \cdot 2^{128} + \text{padding}_1)^{1337} \bmod f
$$

Chỉ cần tính 3 block là đủ (message + padding có tổng độ dài đạt ngưỡng này).

Khi nghịch đảo lũy thừa phải làm trong $GF(2^{128})$.

Hai block padding dùng trong script:

```python
p2 = b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00'
p1 = b'\x80\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'
```

### Solve

<details>
<summary>Bấm để xem Script Giải (Python/SageMath)</summary>

```python
from Crypto.Util.number import *
from pwn import *
import json
from sage.all import *

from md128 import *

r = process(['python3', 'chall2.py'], level='debug')
r = remote('ctf.cnsc.com.vn', 32962, level='debug')

def inv(x):
    return exp(x, 2**128 - 2)

def exp(x, n):
    if n < 0:
        return exp(inv(x), -n)
    if n == 0:
        return 1
    if n % 2:
        return mul(x, exp(x, n - 1))
    return exp(mul(x, x), n // 2)

def md128(msg):
    msg = padding(msg)
    print(msg[:16])
    print(msg[16:32])
    print(msg[32:48])
    iv = to_bytes(0x1234567890abcdefdeadbeef1337dada)
    for i in range(0, len(msg), 16):
        block = msg[i:i + 16]
        state = function(iv, block)
        print(state, to_bytes(mul(from_bytes(iv), exp(2, 128))))
        iv = state
    return state

target = bytes.fromhex(r.recvline().decode().strip())
iv = to_bytes(0x1234567890abcdefdeadbeef1337dada)
p2 = b'\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x01\x00'
p1 = b'\x80\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00'

d = pow(1337, -1, 2**128 - 1)
inv_x128 = exp(2, -128)

# (((iv * 2^128 + T)^1337 * 2^128 + m1)^1337 * 2^128 + m2)^1337
state3 = exp(from_bytes(target), d)
state2_2 = state3 ^ from_bytes(p2)
state2 = mul(state2_2, inv_x128)
print(f'{to_bytes(state2)= }')

state1_exp = exp(state2, d)
state1_2 = state1_exp ^ from_bytes(p1)
state1 = mul(state1_2, inv_x128)
print(f'{to_bytes(state1)= }')

state0_exp = exp(state1, d)
T = state0_exp ^ mul(from_bytes(iv), exp(2, 128))
print(to_bytes(T))

assert md128(to_bytes(T)) == target
r.sendline(to_bytes(T).hex())
r.recv()
```

</details>

## Heartbreak - Sigma

### Analysis

Chall:

```python
from Crypto.Util.number import getPrime, bytes_to_long

FLAG = "W1{???}"
FLAG_PART1, FLAG_PART2 = FLAG[:len(FLAG)//2], FLAG[len(FLAG)//2:]

f = open("output.txt", "w")

def part1():
    p = getPrime(2048)
    q = getPrime(2048)
    e = 0x10001
    n = p * q
    d = pow(e, -1, (p-1)*(q-1))

    m = bytes_to_long(FLAG_PART1.encode())
    c = pow(m, e, n)

    f.write("ct = " + str(c))

    hints = [p, q, e, n, d]
    for _ in range(len(hints)):
        hints[_] = (hints[_] * getPrime(1024)) % n
        if hints[_] == 0:
            hints[_] = (hints[_] - 1) % n

    f.write("\nHints = " + str(hints) + "\n")

def part2():
    e = getPrime(10)
    p = getPrime(256)
    q = getPrime(256)
    n = p * q
    m1 = bytes_to_long(FLAG_PART2.encode())
    m2 = m1 >> 8

    c1, c2 = pow(m1, e, n), pow(m2, e, n)
    f.write(f"n = {n}\nc1 = {c1}\nc2 = {c2}\n")

if __name__ == "__main__":
    part1()
    part2()
```

Output:

```python
ct = 239991743627005761506047553716973180857493049128968395824678613535924041735819278721655197652704368009118731671080782572692443257002266295841054097811995343407149181564647568019524547331554506022380795516159222363510661688595308307174873885160951837722610012918052195448795081291878933355634383798002056753336540546915811592763747343189324926404600658482137848658910189331650916354541907427173491308413908173314104508974384232290785538938623142120477030045742266779693627293755590884412082209151425384896460777577066084111556036719259982254175935197376972307183776259868229411302259648873045160120795060467866459055693698198316577983136619062944244317116994863470942099523485902299419458583301056211340627830237050622364646501838811516544340499168319955128200158195905283972429746772105746244910156671549456233908152186037286726530314472293814226978595268877619521165090870514287104577960355240428728213124348138646047728851553209042359051265045752603864312856768918350064549850618348693037041311112677351368226231458377933846664981185928405481697006968220556167073996713389716367133156065980195285148700027809062253416860922839857907535460170132744912543758918516134641462581544039400881675553681819294266618981791250077585566821053
Hints = [1659380349228980310793195740551091998951133377142727433181233112954301485314646349955561783455759149036476737520702967988760310760312391176774501840210477308343796277178701715703164651184747756453236376960884981254635386807663657355175214655034193946682205904113897156938926175413312324159809831274187894029251371896829385517428693915588566248998565348483747234270329027561433356156355227738138379418717200316600111392671357267757409316691191187929104999221832963378673907868493499459459256894553552195468110517716115678897171373484791903085022119845347228569870830569321957438966030560930098761455953418479618027428739560761186901956751224602703471828674970337530768801203531827467185690264637238603523292728974955840936711823826949100349569805942227432262275344597592991937770320032450419910426614638156263968483514069904464463402987714698220412063100772910040673056263954301063853666792319306234733964442731206579494701823, 2473062479389297534384652365580702456631745761133091301459488546735676124432184165907268360691972078275036508838070797476235444908532100862886958054816201240359777405719375503276188588243722655521225159899315126844306119104997283731460041142142861614319514182297180409656236066011186834375282437648078334082114411988739789392926471318552017202390239258487258487037639778148532362214152519137264282830808294108610004403460587358629486534247288993860831438267841520573973916758902637404855712721811250301202405252158590233975917681798839166192235032424495289048875626437256513981936177292903742966118351026329401662519672777610159422234703124064225710846129876359778079390437505753932101501472252131924073957349012610362952003934494293369977045255000415066563914471132856401071867358687200638320541179048296074882945411664474157308113874183763200469775985802906031999934356545932354932945475129644344782759659758587119586377699, 10811389778781749507848369001995006527965136627134898173336798777178617924322548317218123003648199959431162146218350234488676047952720517043381973357960494027353001493321216082118308994614655309535481054291078777020047697030175144901965025751169815034274454689657181813765988172412194436669592236745329922983348687, 302270795345262652787049603034608860428203534578338699389744017410286806560707153186173595970011317749221953776227374491075684575774328458397778789729965544452010822737225229627108698874874960910965283322537095645241316756015118860396297708799504427117968454341778975073542738740964812664233075630257595196115893498655587491091126391722042679460013562303363850840912825755508680428829444388842951146482726568654418889598972824414109879370032604627990857015975495697530048397401132619555923308480516678981072029040306410523264480829688927798146165580384683689546853438820269495274502502143436234210825345362323042888891473423488116618918996618482754420372481893339222050268599796400452566639228520072261554594477336671016198833620427171498256007475831231524217372147783123617237105584613811522861590112133798309937116024168109605161059186745904038968516182034441583819409524470833832445513001764653452246905494902592731421744692331296978104865554556383417129664683066891729999411036376957753554228948901872115141778394712481069999501808719302346670855531871069366050528261442730651167165455031776639195754458920584910014448480393554851269958179362536781346169282601003523441289868134223507188615919092337658908484201829621953970243126, 292884935929549246643624576832991010496540593142708150947518571090956754050658797955786741707549303442499542376031718493862827439931968289137063776270385766876597819025272388601563339731026897291119786098658019861515084557432779618732711248671531045529170282246847559014298960824095511448557742476351035447816620523706582563446012744989424367197536652910056457067991830630881476241325631891896455745762634189112349619740103725259844111996043190764424736601828139403024375351372351763169837210283497390177391509068689722596094161210899552103572279045474893618035695053640281885367691987326728488743356438444158731410968935525788220429173044772188634219137052045984284351149340419125628533953328666109489959225736888258255952666488686965689900369280599239198825803111830614815595803322570878359992207842211026468967074229662081167123002174445268278747577520774432781623852071789431202030569577689851124794177654088403580945598530502231516822280930459410373890257129917535480957183190120541342731664708767982764672591340622307503858396934095635519503588136203556304925670734741505400274178108097309035870578129722954864083937813328351751442713938490297629659866083082398939022316220801556516785394083566880368038684968532814902807429836]
n = 3942322022657678598973964668297464188690492529227912763243818849286024502988170927049337618748813366973108404930787214396933140242919629931061653981563183
c1 = 711628464933911477721875076362382562533209928505813633932265201230108117662370018036520970813120568151605229871541865330790006742825947411425842775387464
c2 = 199593868713063917388131306750677766968978918100656918000052209242691143624414286755644005020481267183225454134184719235765273635594459821952870709463733
```

#### Part 1

Trong `hints`, mỗi giá trị được biến đổi theo:

$$
\text{hint}_i = (\text{hint}_i \cdot \text{prime}_{1024}) \bmod n
$$

Nếu ra `0` thì set về:

$$
\text{hint}_i = (\text{hint}_i - 1) \bmod n
$$

Từ dữ kiện output, ta suy được:

$$
n = \text{hints}[3] + 1
$$

Vì `n = p \cdot q`, lấy:

$$
p = \gcd(\text{hints}[0], n), \quad q = n / p
$$

Rồi giải RSA bình thường để lấy `FLAG_PART1`.

#### Part 2

Bài cho:

$$
c_1 = m_1^e \bmod n
$$

$$
c_2 = m_2^e \bmod n
$$

với:

$$
m_2 = m_1 \gg 8 = \left\lfloor \frac{m_1}{2^8} \right\rfloor
$$

`e` là prime 10-bit, nên brute được.

Đặt $m_2 = x$ thì:

$$
c_1 = (x \cdot 256 + b)^e \bmod n
$$

với $b \in [0, 255]$, và ở đây byte cuối biết trước là `}`.

$$
c_2 = x^e \bmod n
$$

Từ đó giải nghiệm qua GCD đa thức trên $\mathbb{Z}_n[x]$.

### Solve

<details>
<summary>Bấm để xem Script Giải (Python/SageMath)</summary>

```python
from Crypto.Util.number import *

# Part 1

e = 0x10001
n = hints[3] + 1
p = gcd(hints[0], n)
q = n // p
phi = (p - 1) * (q - 1)
d = inverse(e, phi)
m = pow(int(ct), int(d), int(n))
FLAG_PART1 = long_to_bytes(m)
print(FLAG_PART1)

# Part 2

def gcd_zmod(f, g):
    while g:
        f, g = g, f % g
    return f

prim = [521, 523, 541, 547, 557, 563, 569, 571, 577, 587, 593, 599, 601, 607, 613, 617, 619, 631, 641, 643, 647, 653, 659, 661, 673, 677, 683, 691, 701, 709, 719, 727, 733, 739, 743, 751, 757, 761, 769, 773, 787, 797, 809, 811, 821, 823, 827, 829, 839, 853, 857, 859, 863, 877, 881, 883, 887, 907, 911, 919, 929, 937, 941, 947, 953, 967, 971, 977, 983, 991, 997, 1009, 1013, 1019, 1021]
F = Zmod(n)
P = PolynomialRing(F, 'x')
x = P.gen()

for e in prim:
    f = (x * 256 + bytes_to_long(b'}'))**e - F(c1)
    g = x**e - F(c2)
    m = gcd_zmod(f, g)

    coeff = m.coefficients()
    if len(coeff) > 1:
        root = (-coeff[0]) / coeff[1]
        print(long_to_bytes(int(root * 256 + bytes_to_long(b'}'))).decode())
```

</details>

## Choose - Giapp

### Analysis

`chall.py`:

```python
from aes import *
import random
import os

def dumb_step(s, key=None):
    pass

key = os.urandom(16)
cipher = AES(key)
init_step = [add_round_key, sub_bytes, shift_rows, mix_columns]

for round in range(50):
    try:
        print(f"Round {round + 1}/50")
        plaintext = bytes.fromhex(input(">>> "))
        assert len(plaintext) <= 16 * 3, "Too long!"
        step = init_step[:]
        pos = random.randint(0, 3)
        step.pop(pos)
        step.insert(pos, dumb_step)
        bit = random.randint(0, 1)
        print(cipher.encrypt(plaintext, [init_step, step][bit]).hex())
        if int(input(">>> ")) != bit:
            print("Wrong!")
            exit(0)
        else:
            print("Correct!")
    except:
        exit(0)

print("Here is your flag !")
print(open("flag.txt", "r").read())
```

Bài này có tài liệu khá sát với ý tưởng giải:

https://wrth.medium.com/cracking-aes-without-any-one-of-its-operations-c42cdfc0452f

### Solve

Ảnh solve by author Giapp:

![image](https://hackmd.io/_uploads/HkxswF6xex.png)

*Script phân loại round thiếu bước AES.*

<details>
<summary>Bấm để xem Script Giải (Python/SageMath)</summary>

```python
from pwn import *
from aes import *
import os

def dumb_step(s, key=None):
    pass

aes_fake = AES(os.urandom(16))
plaintext1 = bytes([1, 2, 3, 4, 5, 6, 7, 8] + [0] * 8)
plaintext2 = bytes([1, 2, 3, 4, 5, 6, 7, 9] + [0] * 8)
plaintext3 = bytes([16, 16, 16, 16, 16, 16, 16, 17] + [16] * 8)
plaintext = plaintext1 + plaintext2 + plaintext3

target = process(["python3", "chall.py"])

def check_diff(x, y):
    return sum([int(xx != yy) for xx, yy in zip(x, y)])

for _ in range(50):
    target.recvline()
    target.sendlineafter(b">>> ", plaintext.hex().encode())
    recv = split_blocks(unhex(target.recvline().decode().strip()))
    if check_diff(recv[0], recv[1]) in [1, 4]:
        target.sendlineafter(b">>> ", b"1")
    elif aes_fake.decrypt_block(recv[0], dumb_step) == plaintext1:
        target.sendlineafter(b">>> ", b"1")
    elif xor(recv[0], recv[1], recv[2]) == recv[3]:
        target.sendlineafter(b">>> ", b"1")
    else:
        target.sendlineafter(b">>> ", b"0")
    target.recvline()

target.interactive()
```

</details>

Ghi chú cá nhân: mình có sửa nhẹ phần `decrypt`; thực tế có thể tận dụng trực tiếp `encrypt` do tính chất round thiếu bước không phụ thuộc key theo cách khai thác này.

## Tư liệu tham khảo

- Gemini
- Grok 3
- ChatGPT
- DeepSeek
- ...
