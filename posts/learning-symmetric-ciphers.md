# Symmetric Ciphers

**Tags:** #SymmetricCipher #Cryptography #AES #Writeup

> Nhan_laptop
> ---

Đây là wu báo cáo về bài tập và các implement liên quan.

## Lý thuyết và cách cài đặt:

### lý thuyết:

- AES là mật mã khối, khác với các mã khối đã biết từ trước, dữ liệu trong AES được biểu diễn dưới dạng ma trận 4x4 và được gọi là ma trận trạng thái (state). Dữ liệu đầu vào được đọc theo ma trận sate từng cột 1, và theo thứ tự từ trên xuống - dữ liệu đầu ra như thế:

$$
S =
\begin{pmatrix}
s_{00} & s_{01} & s_{02} & s_{03} \\
s_{10} & s_{11} & s_{12} & s_{13} \\
s_{20} & s_{21} & s_{22} & s_{23} \\
s_{30} & s_{31} & s_{32} & s_{33}
\end{pmatrix}
$$

- Khóa vòng cũng được biểu diễn tương tự như thế:

$$
K =
\begin{pmatrix}
k_{00} & k_{01} & k_{02} & k_{03} \\
k_{10} & k_{11} & k_{12} & k_{13} \\
k_{20} & k_{21} & k_{22} & k_{23} \\
k_{30} & k_{31} & k_{32} & k_{33}
\end{pmatrix}
$$

- Khái niệm về "WORDS": bốn bytes trên mỗi hàng được định nghĩa thành một "từ" 32 bit.

### Thuật toán và cách cài đặt:

- Quá trình mã hóa theo các bước sau:
  - Mở rộng khóa: từ 128 key bit sẽ tạo ra 11 khóa vòng dùng để thực hiện ở bước AddRoundkey.
  - Khởi động vòng lập:
    - AddRoundKey: Mỗi cột của trạng thái đầu sẽ được xor với khóa vòng từ đầu dãy khóa:
    - ![image](https://hackmd.io/_uploads/B1BgGHnt1l.png)
      *Hình: AddRoundKey trong AES.*
  - Vòng lặp:
    - Subbytes - đây là phép ánh xạ: mỗi byte trong trạng thái ban đầu sẽ được thay thế bằng một byte mới trong bảng S_box ([Rijndael S-box](https://en.wikipedia.org/wiki/Rijndael_S-box)), nhầm mục đích phá vỡ sự tuyến tính.
    - ![image](https://hackmd.io/_uploads/B1AHQB2Kkg.png)
      *Hình: SubBytes.*

    - ShiftRows: ba hàng cuối cùng của bảng trạng thái sẽ được dịch chuyển theo 1 - 2 - 3 cột.
    - ![image](https://hackmd.io/_uploads/ByKOmHhFke.png)
      *Hình: ShiftRows.*
    - MixColumns: phép nhân ma trận sẽ được thực hiện trên các cột của trạng thái, kết hợp 4 bytes trong mỗi cột. Bước này sẽ bị lược bỏ ở vòng cuối.
    - ![image](https://hackmd.io/_uploads/r1qf4r3YJg.png)
      *Hình: MixColumns.*
    - AddRoundKey: "xor" các bytes của trạng thái hiện tại với các bytes của "Roundkey".

* Giải thích chi tiết:
  - Bước SubBytes: Các bytes được thay thế bằng bảng S_box (như đã đề cập), Hộp S_box được tạo nên từ một [phép biến đổi khả nghịch](https://www.samiam.org/galois.html) trong trường hữu hạn $GF(2^8)$ (một cách nói ví von cho vui nhưng thật ra trường hữu hạn này không giống thứ chúng ta được học trong đại số, mà trường này có các thành phần hữu hạn nên được gọi như thế) có tính chất phi tuyến tính.
  - Bước ShiftRows: Các hàng cuối cùng được dịch từ trái lần lượt từ 3 cột đến 1 cột từ dưới lên trên.
  - Bước MixColumns: Bốn bytes trong từng cột sẽ được kết hợp lại theo một tính chất phi tuyến tính, mỗi giá trị byte khi thay đổi sẽ làm ảnh hưởng đến hết những byte còn lại. Mỗi cột được xem như như một đa thức trong trường hữu hạng và được nhân với đa thức: $c(x)= 3.x^3 + x^2 + x + 2 \mod (x^4 + 1)$. Được gọi là [phép nhân ma](https://www.samiam.org/mix-column.html) trận trong trường hữu hạn Galois.
  - ![image](https://hackmd.io/_uploads/rkikFS2Kyx.png)
    *Hình: Biểu diễn MixColumns theo trường Galois.*

***Tài liệu tham khảo**:

- link: [here](https://cs.ru.nl/~joan/papers/JDA_VRI_Rijndael_2002.pdf)

### Cách cài đặt:

- implement.py:

```python
N_ROUNDS = 10

key        = b'?'
ciphertext = b'?'

def add_round_key(sate,key):
    for i in range(4):
        for j in range(4):
            sate[i][j] = key[i][j] ^ sate[i][j]
    return sate

def inv_shift_rows(s):
    s[1][1], s[2][1], s[3][1], s[0][1] = s[0][1], s[1][1], s[2][1], s[3][1]
    s[2][2], s[3][2], s[0][2], s[1][2] = s[0][2], s[1][2], s[2][2], s[3][2]
    s[3][3], s[0][3], s[1][3], s[2][3] = s[0][3], s[1][3], s[2][3], s[3][3]

s_box = (
    0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
    0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
    0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
    0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
    0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
    0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
    0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
    0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
    0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
    0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
    0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
    0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
    0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
    0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
    0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
    0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16,
)

inv_s_box = (
    0x52, 0x09, 0x6A, 0xD5, 0x30, 0x36, 0xA5, 0x38, 0xBF, 0x40, 0xA3, 0x9E, 0x81, 0xF3, 0xD7, 0xFB,
    0x7C, 0xE3, 0x39, 0x82, 0x9B, 0x2F, 0xFF, 0x87, 0x34, 0x8E, 0x43, 0x44, 0xC4, 0xDE, 0xE9, 0xCB,
    0x54, 0x7B, 0x94, 0x32, 0xA6, 0xC2, 0x23, 0x3D, 0xEE, 0x4C, 0x95, 0x0B, 0x42, 0xFA, 0xC3, 0x4E,
    0x08, 0x2E, 0xA1, 0x66, 0x28, 0xD9, 0x24, 0xB2, 0x76, 0x5B, 0xA2, 0x49, 0x6D, 0x8B, 0xD1, 0x25,
    0x72, 0xF8, 0xF6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xD4, 0xA4, 0x5C, 0xCC, 0x5D, 0x65, 0xB6, 0x92,
    0x6C, 0x70, 0x48, 0x50, 0xFD, 0xED, 0xB9, 0xDA, 0x5E, 0x15, 0x46, 0x57, 0xA7, 0x8D, 0x9D, 0x84,
    0x90, 0xD8, 0xAB, 0x00, 0x8C, 0xBC, 0xD3, 0x0A, 0xF7, 0xE4, 0x58, 0x05, 0xB8, 0xB3, 0x45, 0x06,
    0xD0, 0x2C, 0x1E, 0x8F, 0xCA, 0x3F, 0x0F, 0x02, 0xC1, 0xAF, 0xBD, 0x03, 0x01, 0x13, 0x8A, 0x6B,
    0x3A, 0x91, 0x11, 0x41, 0x4F, 0x67, 0xDC, 0xEA, 0x97, 0xF2, 0xCF, 0xCE, 0xF0, 0xB4, 0xE6, 0x73,
    0x96, 0xAC, 0x74, 0x22, 0xE7, 0xAD, 0x35, 0x85, 0xE2, 0xF9, 0x37, 0xE8, 0x1C, 0x75, 0xDF, 0x6E,
    0x47, 0xF1, 0x1A, 0x71, 0x1D, 0x29, 0xC5, 0x89, 0x6F, 0xB7, 0x62, 0x0E, 0xAA, 0x18, 0xBE, 0x1B,
    0xFC, 0x56, 0x3E, 0x4B, 0xC6, 0xD2, 0x79, 0x20, 0x9A, 0xDB, 0xC0, 0xFE, 0x78, 0xCD, 0x5A, 0xF4,
    0x1F, 0xDD, 0xA8, 0x33, 0x88, 0x07, 0xC7, 0x31, 0xB1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xEC, 0x5F,
    0x60, 0x51, 0x7F, 0xA9, 0x19, 0xB5, 0x4A, 0x0D, 0x2D, 0xE5, 0x7A, 0x9F, 0x93, 0xC9, 0x9C, 0xEF,
    0xA0, 0xE0, 0x3B, 0x4D, 0xAE, 0x2A, 0xF5, 0xB0, 0xC8, 0xEB, 0xBB, 0x3C, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2B, 0x04, 0x7E, 0xBA, 0x77, 0xD6, 0x26, 0xE1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0C, 0x7D,
)
def bytes2matrix(text):
    return [list(text[i:i+4]) for i in range(0,len(text),4)]

def matrix2bytes(matrix):
    return bytes(sum(matrix,[]))

def xtime(a):
    if a & 0x80:
        return ((a << 1) ^ 0x1B)& 0xFF
    else:
        return a << 1
    
def mix_single_column(a):
    t = a[0] ^ a[1] ^ a[2] ^ a[3]
    u = a[0]
    a[0]^= t ^ xtime(a[0] ^ a[1])
    a[1]^= t ^ xtime(a[1] ^ a[2])
    a[2]^= t ^ xtime(a[2] ^ a[3])
    a[3]^= t ^ xtime(a[3] ^ u)

def mix_columns(s):
    for i in range(4):
        mix_single_column(s[i])

def inv_mix_columns(s):
    for i in range(4):
        u = xtime(xtime(s[i][0] ^ s[i][2]))
        v = xtime(xtime(s[i][1] ^ s[i][3]))
        s[i][0] ^= u
        s[i][1] ^= v
        s[i][2] ^= u
        s[i][3] ^= v
    mix_columns(s)

def inv_sub_bytes(s):
    for i in range(4):
        for j in range(4):
            s[i][j] = inv_s_box[s[i][j]]

def expand_key(master_key):
    """
    Expands and returns a list of key matrices for the given master_key.
    """
    # print()
    # Round constants https://en.wikipedia.org/wiki/AES_key_schedule#Round_constants
    r_con = (
        0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40,
        0x80, 0x1B, 0x36, 0x6C, 0xD8, 0xAB, 0x4D, 0x9A,
        0x2F, 0x5E, 0xBC, 0x63, 0xC6, 0x97, 0x35, 0x6A,
        0xD4, 0xB3, 0x7D, 0xFA, 0xEF, 0xC5, 0x91, 0x39,
    )

    # Initialize round keys with raw key material.
    key_columns = bytes2matrix(master_key)
    # print(key_columns)
    iteration_size = len(master_key) // 4

    # Each iteration has exactly as many columns as the key material.
    i = 1
    while len(key_columns) < (N_ROUNDS + 1) * 4:
        # Copy previous word.
        word = list(key_columns[-1])

        # Perform schedule_core once every "row".
        if len(key_columns) % iteration_size == 0:
            # Circular shift.
            word.append(word.pop(0))
            # Map to S-BOX.
            word = [s_box[b] for b in word]
            # XOR with first byte of R-CON, since the others bytes of R-CON are 0.
            word[0] ^= r_con[i]
            i += 1
        elif len(master_key) == 32 and len(key_columns) % iteration_size == 4:
            # Run word through S-box in the fourth iteration when using a
            # 256-bit key.
            word = [s_box[b] for b in word]

        # XOR with equivalent word from previous iteration.
        word = bytes(i^j for i, j in zip(word, key_columns[-iteration_size]))
        key_columns.append(word)

    # Group key words in 4x4 byte matrices.
    return [key_columns[4*i : 4*(i+1)] for i in range(len(key_columns) // 4)]


def decrypt(key, ciphertext):
    round_keys = expand_key(key) # Remember to start from the last round key and work backwards through them when decrypting

    # Convert ciphertext to state matrix
    state = bytes2matrix(ciphertext)
    # Initial add round key step
    state = add_round_key(state, round_keys[-1])

    for i in range(N_ROUNDS - 1, 0, -1):
        inv_shift_rows(state)
        inv_sub_bytes(state)
        state = add_round_key(state, round_keys[i])
        inv_mix_columns(state)
        # pass # Do round

    # Run final round (skips the InvMixColumns step)
    inv_shift_rows(state)
    inv_sub_bytes(state)
    state = add_round_key(state, round_keys[0])
    # Convert state matrix to plaintext
    plaintext = matrix2bytes(state)
    return plaintext


print(decrypt(key, ciphertext))


```

***LƯU Ý***: có thể thấy rõ trong cách cài đặt này, sẽ đôi phần khác với MixColumns mà tôi đã kèm theo link trong hướng dẫn, nhưng hãy cùng nhìn lại về mặt toán học một chút:

- Về mặt nhân ma trận thì như các bạn đã được học thì sẽ như sau:

$$
\begin{pmatrix}
2 & 3 & 1 & 1 \\
1 & 2 & 3 & 1 \\
1 & 1 & 2 & 3 \\
3 & 1 & 1 & 2
\end{pmatrix}
\cdot
\begin{pmatrix}
s_{00} & s_{01} & s_{02} & s_{03} \\
s_{10} & s_{11} & s_{12} & s_{13} \\
s_{20} & s_{21} & s_{22} & s_{23} \\
s_{30} & s_{31} & s_{32} & s_{33}
\end{pmatrix}
=
\begin{pmatrix}
s'_{00} & s'_{01} & s'_{02} & s'_{03} \\
s'_{10} & s'_{11} & s'_{12} & s'_{13} \\
s'_{20} & s'_{21} & s'_{22} & s'_{23} \\
s'_{30} & s'_{31} & s'_{32} & s'_{33}
\end{pmatrix}
$$

- Với:

$$
\begin{aligned}
s'_{0,j} &= (2 \cdot s_{0,j}) \oplus (3 \cdot s_{1,j}) \oplus (1 \cdot s_{2,j}) \oplus (1 \cdot s_{3,j}) \\
s'_{1,j} &= (1 \cdot s_{0,j}) \oplus (2 \cdot s_{1,j}) \oplus (3 \cdot s_{2,j}) \oplus (1 \cdot s_{3,j}) \\
s'_{2,j} &= (1 \cdot s_{0,j}) \oplus (1 \cdot s_{1,j}) \oplus (2 \cdot s_{2,j}) \oplus (3 \cdot s_{3,j}) \\
s'_{3,j} &= (3 \cdot s_{0,j}) \oplus (1 \cdot s_{1,j}) \oplus (1 \cdot s_{2,j}) \oplus (2 \cdot s_{3,j})
\end{aligned}
$$

- Nhìn lên trên ta sẽ thấy, nếu cài đặt thì sẽ khác với source code trên đúng chứ.
- Hãy cùng xem qua ví dụ này:
- ![image](https://hackmd.io/_uploads/Hk8ToHhYJg.png)
  *Hình: Biến đổi để rút gọn MixColumns thành xtime.*
- Từ đây ta có thể hiểu được rồi: xtime là phép nhân với 2.
- Và bằng nhiều cách thu gọn ta sẽ được kết quả như code trên.
- Về phần decrypt_mixcolumns, tại sao lại nhân ma trận trạng thái cho ma trận đa thức một lần nữa: bản chất của việc này là nhân lại với ma trận nghịch đảo của đa thức, mà ma trận nghịch đảo ta nói chính là:
- ![image](https://hackmd.io/_uploads/rJ9hDu3FJl.png)
  *Hình: Ma trận nghịch đảo trong InvMixColumns.*

### Một cách implement bằng đa thức trong trường Galois

- Đầy đủ encrypt lẫn decrypt.

```python


from pwn import *
from Crypto.Util.number import *
from sage.all import *

N_ROUNDS = 10


x = GF(2)["x"].gen()
gf2e = GF( 2**8 , name = "y" , modulus = x**8 + x**4 + x**3 + x + 1  )

def _to_gf2e(n):
    return gf2e([(n >> i) & 1 for i in range(0, 8)])

def _from_gf2e(p):
    n = p.integer_representation()
    return n

def to_ma_gf2e(s):
    state_matrix = Matrix(gf2e, [[_to_gf2e(s[i][j]) for j in range(4)] for i in range(4)])
    return state_matrix 
def from_ma_gf2e(state_matrix):

    return [[_from_gf2e(state_matrix[i,j]) for j in range(state_matrix.ncols())] for i in range(state_matrix.nrows())]

key        = b'\xc3,\\\xa6\xb5\x80^\x0c\xdb\x8d\xa5z*\xb6\xfe\\'
ciphertext = b'\xd1O\x14j\xa4+O\xb6\xa1\xc4\x08B)\x8f\x12\xdd'
plaintext  = b'crypto{MYAES128}'


def add_round_key(state,key):
    
    state  = state + key 
    return state

def inv_shift_rows(s):
    s[1,1], s[2,1], s[3,1], s[0,1] = s[0,1], s[1,1], s[2,1], s[3,1]
    s[2,2], s[3,2], s[0,2], s[1,2] = s[0,2], s[1,2], s[2,2], s[3,2]
    s[3,3], s[0,3], s[1,3], s[2,3] = s[0,3], s[1,3], s[2,3], s[3,3]
    
    return s 
    


def shift_rows(s):

    s[0,1], s[1,1], s[2,1], s[3,1] = s[1,1], s[2,1], s[3,1], s[0,1]
    s[0,2], s[1,2], s[2,2], s[3,2] = s[2,2], s[3,2], s[0,2], s[1,2]
    s[0,3], s[1,3], s[2,3], s[3,3] = s[3,3], s[0,3], s[1,3], s[2,3]
    return s 

s_box = (
    0x63, 0x7C, 0x77, 0x7B, 0xF2, 0x6B, 0x6F, 0xC5, 0x30, 0x01, 0x67, 0x2B, 0xFE, 0xD7, 0xAB, 0x76,
    0xCA, 0x82, 0xC9, 0x7D, 0xFA, 0x59, 0x47, 0xF0, 0xAD, 0xD4, 0xA2, 0xAF, 0x9C, 0xA4, 0x72, 0xC0,
    0xB7, 0xFD, 0x93, 0x26, 0x36, 0x3F, 0xF7, 0xCC, 0x34, 0xA5, 0xE5, 0xF1, 0x71, 0xD8, 0x31, 0x15,
    0x04, 0xC7, 0x23, 0xC3, 0x18, 0x96, 0x05, 0x9A, 0x07, 0x12, 0x80, 0xE2, 0xEB, 0x27, 0xB2, 0x75,
    0x09, 0x83, 0x2C, 0x1A, 0x1B, 0x6E, 0x5A, 0xA0, 0x52, 0x3B, 0xD6, 0xB3, 0x29, 0xE3, 0x2F, 0x84,
    0x53, 0xD1, 0x00, 0xED, 0x20, 0xFC, 0xB1, 0x5B, 0x6A, 0xCB, 0xBE, 0x39, 0x4A, 0x4C, 0x58, 0xCF,
    0xD0, 0xEF, 0xAA, 0xFB, 0x43, 0x4D, 0x33, 0x85, 0x45, 0xF9, 0x02, 0x7F, 0x50, 0x3C, 0x9F, 0xA8,
    0x51, 0xA3, 0x40, 0x8F, 0x92, 0x9D, 0x38, 0xF5, 0xBC, 0xB6, 0xDA, 0x21, 0x10, 0xFF, 0xF3, 0xD2,
    0xCD, 0x0C, 0x13, 0xEC, 0x5F, 0x97, 0x44, 0x17, 0xC4, 0xA7, 0x7E, 0x3D, 0x64, 0x5D, 0x19, 0x73,
    0x60, 0x81, 0x4F, 0xDC, 0x22, 0x2A, 0x90, 0x88, 0x46, 0xEE, 0xB8, 0x14, 0xDE, 0x5E, 0x0B, 0xDB,
    0xE0, 0x32, 0x3A, 0x0A, 0x49, 0x06, 0x24, 0x5C, 0xC2, 0xD3, 0xAC, 0x62, 0x91, 0x95, 0xE4, 0x79,
    0xE7, 0xC8, 0x37, 0x6D, 0x8D, 0xD5, 0x4E, 0xA9, 0x6C, 0x56, 0xF4, 0xEA, 0x65, 0x7A, 0xAE, 0x08,
    0xBA, 0x78, 0x25, 0x2E, 0x1C, 0xA6, 0xB4, 0xC6, 0xE8, 0xDD, 0x74, 0x1F, 0x4B, 0xBD, 0x8B, 0x8A,
    0x70, 0x3E, 0xB5, 0x66, 0x48, 0x03, 0xF6, 0x0E, 0x61, 0x35, 0x57, 0xB9, 0x86, 0xC1, 0x1D, 0x9E,
    0xE1, 0xF8, 0x98, 0x11, 0x69, 0xD9, 0x8E, 0x94, 0x9B, 0x1E, 0x87, 0xE9, 0xCE, 0x55, 0x28, 0xDF,
    0x8C, 0xA1, 0x89, 0x0D, 0xBF, 0xE6, 0x42, 0x68, 0x41, 0x99, 0x2D, 0x0F, 0xB0, 0x54, 0xBB, 0x16,
)

inv_s_box = (
    0x52, 0x09, 0x6A, 0xD5, 0x30, 0x36, 0xA5, 0x38, 0xBF, 0x40, 0xA3, 0x9E, 0x81, 0xF3, 0xD7, 0xFB,
    0x7C, 0xE3, 0x39, 0x82, 0x9B, 0x2F, 0xFF, 0x87, 0x34, 0x8E, 0x43, 0x44, 0xC4, 0xDE, 0xE9, 0xCB,
    0x54, 0x7B, 0x94, 0x32, 0xA6, 0xC2, 0x23, 0x3D, 0xEE, 0x4C, 0x95, 0x0B, 0x42, 0xFA, 0xC3, 0x4E,
    0x08, 0x2E, 0xA1, 0x66, 0x28, 0xD9, 0x24, 0xB2, 0x76, 0x5B, 0xA2, 0x49, 0x6D, 0x8B, 0xD1, 0x25,
    0x72, 0xF8, 0xF6, 0x64, 0x86, 0x68, 0x98, 0x16, 0xD4, 0xA4, 0x5C, 0xCC, 0x5D, 0x65, 0xB6, 0x92,
    0x6C, 0x70, 0x48, 0x50, 0xFD, 0xED, 0xB9, 0xDA, 0x5E, 0x15, 0x46, 0x57, 0xA7, 0x8D, 0x9D, 0x84,
    0x90, 0xD8, 0xAB, 0x00, 0x8C, 0xBC, 0xD3, 0x0A, 0xF7, 0xE4, 0x58, 0x05, 0xB8, 0xB3, 0x45, 0x06,
    0xD0, 0x2C, 0x1E, 0x8F, 0xCA, 0x3F, 0x0F, 0x02, 0xC1, 0xAF, 0xBD, 0x03, 0x01, 0x13, 0x8A, 0x6B,
    0x3A, 0x91, 0x11, 0x41, 0x4F, 0x67, 0xDC, 0xEA, 0x97, 0xF2, 0xCF, 0xCE, 0xF0, 0xB4, 0xE6, 0x73,
    0x96, 0xAC, 0x74, 0x22, 0xE7, 0xAD, 0x35, 0x85, 0xE2, 0xF9, 0x37, 0xE8, 0x1C, 0x75, 0xDF, 0x6E,
    0x47, 0xF1, 0x1A, 0x71, 0x1D, 0x29, 0xC5, 0x89, 0x6F, 0xB7, 0x62, 0x0E, 0xAA, 0x18, 0xBE, 0x1B,
    0xFC, 0x56, 0x3E, 0x4B, 0xC6, 0xD2, 0x79, 0x20, 0x9A, 0xDB, 0xC0, 0xFE, 0x78, 0xCD, 0x5A, 0xF4,
    0x1F, 0xDD, 0xA8, 0x33, 0x88, 0x07, 0xC7, 0x31, 0xB1, 0x12, 0x10, 0x59, 0x27, 0x80, 0xEC, 0x5F,
    0x60, 0x51, 0x7F, 0xA9, 0x19, 0xB5, 0x4A, 0x0D, 0x2D, 0xE5, 0x7A, 0x9F, 0x93, 0xC9, 0x9C, 0xEF,
    0xA0, 0xE0, 0x3B, 0x4D, 0xAE, 0x2A, 0xF5, 0xB0, 0xC8, 0xEB, 0xBB, 0x3C, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2B, 0x04, 0x7E, 0xBA, 0x77, 0xD6, 0x26, 0xE1, 0x69, 0x14, 0x63, 0x55, 0x21, 0x0C, 0x7D,
)
def bytes2matrix(text):
    return [list(text[i:i+4]) for i in range(0,len(text),4)]

def matrix2bytes(matrix):
    return bytes(sum(matrix,[]))

def xtime(a):
    if a & 0x80:
        return ((a << 1) ^ 0x1B)& 0xFF
    else:
        return a << 1
    
def mix_columns(s):
    int_array =  [
        [2, 3, 1, 1],
        [1, 2, 3, 1],
        [1, 1, 2, 3],
        [3, 1, 1, 2]
    ]
    mix_matrix = to_ma_gf2e(int_array)
    # print(mix_matrix)
    # exit(0)
    
    s  =s * mix_matrix.T
    return s


def inv_mix_columns(s):
    int_array =  [
        [14, 11, 13, 9 ],
        [ 9, 14, 11, 13],
        [13,  9, 14, 11],
        [11, 13,  9, 14]
    ]
    mix_matrix = to_ma_gf2e(int_array)
    
    s  =s * mix_matrix.T
    return s

def inv_sub_bytes(s):
    s = from_ma_gf2e(s)
    for i in range(4):
        for j in range(4):
            s[i][j] = inv_s_box[s[i][j]]
    s = to_ma_gf2e(s)
    return s
    

def sub_bytes(s):
    s = from_ma_gf2e(s)
    for i in range(4):
        for j in range(4):
            s[i][j] = s_box[s[i][j]]
    s = to_ma_gf2e(s)
    return s


def expand_key(master_key):
    """
    Expands and returns a list of key matrices for the given master_key.
    """
    # print()
    # Round constants https://en.wikipedia.org/wiki/AES_key_schedule#Round_constants
    r_con = (
        0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40,
        0x80, 0x1B, 0x36, 0x6C, 0xD8, 0xAB, 0x4D, 0x9A,
        0x2F, 0x5E, 0xBC, 0x63, 0xC6, 0x97, 0x35, 0x6A,
        0xD4, 0xB3, 0x7D, 0xFA, 0xEF, 0xC5, 0x91, 0x39,
    )

    # Initialize round keys with raw key material.
    key_columns = bytes2matrix(master_key)
    # print(key_columns)
    iteration_size = len(master_key) // 4

    # Each iteration has exactly as many columns as the key material.
    i = 1
    while len(key_columns) < (N_ROUNDS + 1) * 4:
        # Copy previous word.
        word = list(key_columns[-1])

        # Perform schedule_core once every "row".
        if len(key_columns) % iteration_size == 0:
            # Circular shift.
            word.append(word.pop(0))
            # Map to S-BOX.
            word = [s_box[b] for b in word]
            # XOR with first byte of R-CON, since the others bytes of R-CON are 0.
            word[0] ^= r_con[i]
            i += 1
        elif len(master_key) == 32 and len(key_columns) % iteration_size == 4:
            # Run word through S-box in the fourth iteration when using a
            # 256-bit key.
            word = [s_box[b] for b in word]

        # XOR with equivalent word from previous iteration.
        word = bytes(i^j for i, j in zip(word, key_columns[-iteration_size]))
        key_columns.append(word)

    # Group key words in 4x4 byte matrices.
    return [key_columns[4*i : 4*(i+1)] for i in range(len(key_columns) // 4)]

round_keys = expand_key(key)

round_keys = [to_ma_gf2e(round_keys[i]) for i in range(11)]


def decrypt(key, ciphertext):
    
    state = bytes2matrix(ciphertext)
    state  = to_ma_gf2e(state)
    state = state + round_keys[-1]

    
    for i in range(N_ROUNDS - 1, 0, -1):
        state = inv_shift_rows(state)
        state = inv_sub_bytes(state)
        state = state + round_keys[i]
        state = inv_mix_columns(state)

    state = inv_shift_rows(state)
    state = inv_sub_bytes(state)
    state = state + round_keys[0]

    plaintext = from_ma_gf2e(state)
    tmp = b""
    for i in range(4):
        for j in range(4):
            tmp = tmp + bytes([plaintext[i][j]])
    return tmp 


def encrypt(key, plaintext):
    
    state = bytes2matrix(plaintext)
    state  = to_ma_gf2e(state)
    state = state + round_keys[0]
    
    for i in range(1, N_ROUNDS):
        state = sub_bytes(state)
        state = shift_rows(state)
        state = mix_columns(state)
        state = state + round_keys[i]

    state = sub_bytes(state)
    state = shift_rows(state)
    state = state + round_keys[N_ROUNDS]

    ciphertext = from_ma_gf2e(state)
    tmp = b""
    for i in range(4):
        for j in range(4):
            tmp = tmp + bytes([ciphertext[i][j]])
    return tmp 

ciphertext = encrypt(key,plaintext)
print(ciphertext)
print(decrypt(key, ciphertext))




```

## Cipher chemes in AES

![image](https://hackmd.io/_uploads/H1sF-IhtJe.png)
*Hình: Tổng quan các mode trong AES.*

### ECB

> **Mục tiêu:** Nắm công thức mã hóa/giải mã theo block độc lập.

![image](https://hackmd.io/_uploads/Bk-DxZI51g.png)
*Hình: Sơ đồ ECB.*

Encrypt:

$$
\begin{aligned}
C_1 &= E_{\text{key}}(P_1) \\
C_2 &= E_{\text{key}}(P_2) \\
C_3 &= E_{\text{key}}(P_3) \\
\vdots \\
C_n &= E_{\text{key}}(P_n)
\end{aligned}
$$

Decrypt:

$$
\begin{aligned}
P_1 &= D_{\text{key}}(C_1) \\
P_2 &= D_{\text{key}}(C_2) \\
P_3 &= D_{\text{key}}(C_3) \\
\vdots \\
P_n &= D_{\text{key}}(C_n)
\end{aligned}
$$

### CBC

> **Mục tiêu:** Nắm liên kết giữa các block qua IV/Ciphertext trước đó.

![image](https://hackmd.io/_uploads/HJYZVZIckl.png)
*Hình: Sơ đồ CBC.*

Encrypt:

$$
\begin{aligned}
C_1 &= E_{\text{key}}(P_1\ \oplus\ IV ) \\
C_2 &= E_{\text{key}}(P_2\ \oplus\ C_1 ) \\
C_3 &= E_{\text{key}}(P_3\ \oplus\ C_2 ) \\
\vdots \\
C_n &= E_{\text{key}}(P_n\ \oplus\ C_{n-1} )
\end{aligned}
$$

Decrypt:

$$
\begin{aligned}
P_1 &= D_{\text{key}}(C_1)\ \oplus\ IV \\
P_2 &= D_{\text{key}}(C_2)\ \oplus\ C_1 \\
P_3 &= D_{\text{key}}(C_3)\ \oplus\ C_2 \\
\vdots \\
P_n &= D_{\text{key}}(C_n)\ \oplus\ C_{n-1}
\end{aligned}
$$

### AES-GCM

> **Mục tiêu:** Hiểu thêm lớp xác thực GHASH ngoài mã hóa.

![image](https://hackmd.io/_uploads/BkosQiaKyl.png)
*Hình: Sơ đồ mã hóa AES.*

![image](https://hackmd.io/_uploads/HJ-k4iatyl.png)
*Hình: Keystream trong GCM.*

![image](https://hackmd.io/_uploads/H1x0SsTtkl.png)
*Hình: GHASH.*

$$
T = (AD + K).H^n + (P_0+ K).H^{(n-1)}+...+L.H+E(Y_0)
$$

## Thực hành - CRYPTOHACK

Dưới đây mình sẽ giải từ những bài "Block Ciphers" và "Stream Ciphers".

### Block Ciphers 1

### ECB CBC WTF

> **Mục tiêu:** Tách block CBC và lợi dụng API decrypt ECB để recover plaintext.

![image](https://hackmd.io/_uploads/BktRxUnFyx.png)
*Hình: Đề bài ECB CBC WTF.*

![image](https://hackmd.io/_uploads/HJ9yb8hYyx.png)
*Hình: API challenge.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests
from pwn import *
def encrypt():
    url = 'https://aes.cryptohack.org/ecbcbcwtf/encrypt_flag/'
    r = requests.get(url)
    tmp = r.json()
    return bytes.fromhex(tmp["ciphertext"])

def decrypt(ciphertext):
    url = 'https://aes.cryptohack.org/ecbcbcwtf/decrypt/'
    url += ciphertext.hex() + "/"
    r = requests.get(url)
    tmp = r.json()
    return bytes.fromhex(tmp["plaintext"])

conn = encrypt()
iv = conn[:16]
ciphertext  = conn[16:]

flag = b""
block = list([ciphertext[i:i+16] for i in range(0 , len(ciphertext) , 16)])
block = [iv] + block
for i,b in list(enumerate(block))[1:]:
    flag = flag + xor(block[i-1], decrypt(b))
print(flag)
```

</details>

flag = `crypto{3cb_5uck5_4v01d_17_!!!!!}`

### ECB ORACLE

> **Mục tiêu:** Dùng chosen-plaintext để brute-force từng byte ở ECB.

![image](https://hackmd.io/_uploads/ByFBrUhYke.png)
*Hình: ECB Oracle.*

![image](https://hackmd.io/_uploads/rJpku_2KJe.png)
*Hình: API encrypt oracle.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests
from pwn import *

def encrypt(plaintext):
    url = "https://aes.cryptohack.org/ecb_oracle/encrypt/"
    url = url + plaintext.hex() + "/"
    r = requests.get(url)
    conn = r.json()
    return bytes.fromhex(conn["ciphertext"])

flag = b""
for i in range(15,-1,-1):
    plaintext = b'\0'*i
    cipher_flag = encrypt(plaintext)
    for c in range(32,127):
        a = bytes([c])
        plaintext = b'\0'*i + flag + a
        cipher_user = encrypt(plaintext)
        if cipher_user[0:16] == cipher_flag[0:16]:
            flag = flag + a
            break

flag = b'crypto{p3n6u1n5_'
for i in range(15,-1,-1):
    plaintext = b'\0'*i
    cipher_flag = encrypt(plaintext)
    for c in range(32,127):
        a = bytes([c])
        plaintext = b'\0'*i + flag  + a
        cipher_user = encrypt(plaintext)
        if cipher_user[16:32] == cipher_flag[16:32]:
            flag = flag + a
            if a == b'}':
                print(flag)
                exit(0)
            break
```

</details>

flag = `crypto{p3n6u1n5_h473_3cb}`

### Flipping Cookie

> **Mục tiêu:** CBC bit-flipping để đổi `admin=False` thành `admin=True`.

![image](https://hackmd.io/_uploads/Syz7CO2Yke.png)
*Hình: Flipping Cookie challenge.*

![image](https://hackmd.io/_uploads/rygICOntJe.png)
*Hình: API get_cookie/check_admin.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests
from pwn import *

def get_cookie():
    url = "https://aes.cryptohack.org/flipping_cookie/get_cookie/"
    r = requests.get(url)
    conn = r.json()
    return bytes.fromhex(conn["cookie"])

def check_admin(cookie, iv):
    url = "https://aes.cryptohack.org/flipping_cookie/check_admin/"
    url = url + cookie.hex() + "/" + iv.hex() + "/"
    r = requests.get(url)
    print(r.json())

conn = get_cookie()
iv = conn[:16]
ciphertext = conn[16:]

P1 = b"admin=False;expiry={expires_at}"[:16]
P  = b"admin=True" + b";expi?"
iv = xor(iv, xor(P1, P))
check_admin(ciphertext, iv)
```

</details>

flag = `crypto{4u7h3n71c4710n_15_3553n714l}`

### Lazy CBC

> **Mục tiêu:** Khai thác trường hợp `IV = KEY` để recover key.

![image](https://hackmd.io/_uploads/rkE_pj2Ykl.png)
*Hình: Lazy CBC challenge.*

![image](https://hackmd.io/_uploads/HJw5Ts3Ykx.png)
*Hình: Điểm yếu IV = KEY.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests
from pwn import *

def receive(ciphertext):
    url = "https://aes.cryptohack.org/lazy_cbc/receive/" + ciphertext.hex() + "/"
    return requests.get(url).json()['error']

def get_flag(key):
    url = "https://aes.cryptohack.org/lazy_cbc/get_flag/" + key.hex() + "/"
    return bytes.fromhex(requests.get(url).json()['plaintext'])

_ = receive(b'\0'*32)
P = bytes.fromhex("573f4f4ee51f67973be3973ffd30042fad9d7e4b7851a97b9d46a426d2d7da43")
P1 = P[16:]
P2 = P[:16]
K = xor(P1, P2)
print(get_flag(K))
```

</details>

flag = `crypto{50m3_p30pl3_d0n7_7h1nk_IV_15_1mp0r74n7_?}`

### Triple DES

> **Mục tiêu:** Khai thác weak key của DES/3DES.

![image](https://hackmd.io/_uploads/S13uwTnFyl.png)
*Hình: Triple DES challenge.*

![image](https://hackmd.io/_uploads/SJAYv62tke.png)
*Hình: Endpoint encrypt_flag/encrypt.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests

def encrypt_flag(key):
    url = "https://aes.cryptohack.org/triple_des/encrypt_flag/" + key + "/"
    return bytes.fromhex(requests.get(url).json()['ciphertext'])

def encrypt(key, plaintext):
    url = "https://aes.cryptohack.org/triple_des/encrypt/" + key + "/" + plaintext.hex() + "/"
    return bytes.fromhex(requests.get(url).json()['ciphertext'])

key = '0101010101010101FEFEFEFEFEFEFEFE'
ct = encrypt_flag(key)
flag = encrypt(key, ct)
print(flag)
```

</details>

flag = `crypto{n0t_4ll_k3ys_4r3_g00d_k3ys}`

## Stream Ciphers

### Symmetry

> **Mục tiêu:** Khai thác tính đối xứng OFB để lấy keystream.

![image](https://hackmd.io/_uploads/S1f9tTnt1e.png)
*Hình: Symmetry challenge.*

![image](https://hackmd.io/_uploads/HykoYp3Kyx.png)
*Hình: Endpoint encrypt_flag/encrypt.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests
from pwn import *

def encrypt_flag():
    return bytes.fromhex(requests.get("https://aes.cryptohack.org/symmetry/encrypt_flag/").json()['ciphertext'])

def encrypt(plaintext, iv):
    url = "https://aes.cryptohack.org/symmetry/encrypt/" + plaintext.hex() + "/" + iv.hex() + "/"
    return bytes.fromhex(requests.get(url).json()['ciphertext'])

ciphertext = encrypt_flag()
iv = ciphertext[:16]
C = [ciphertext[16:32], ciphertext[32:48], ciphertext[48:]]
E = encrypt(b'\x00'*48, iv)
E = [E[i:i+16] for i in range(0, len(E), 16)]
for i, e in enumerate(E):
    print(xor(e, C[i]), end='')
```

</details>

### Bean Counter

> **Mục tiêu:** Keystream cố định -> xor với known PNG header để khôi phục file.

![image](https://hackmd.io/_uploads/rk1pK6ntJx.png)
*Hình: Bean Counter challenge.*

![image](https://hackmd.io/_uploads/BkeJqT2Y1x.png)
*Hình: Counter increment bug.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests
from pwn import *

png = bytes([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
])

ciphertext = bytes.fromhex(requests.get("https://aes.cryptohack.org/bean_counter/encrypt/").json()['encrypted'])
blocks = [ciphertext[i:i+16] for i in range(0, len(ciphertext), 16)]

flag = png
for c in blocks[1:]:
    flag += xor(blocks[0], xor(c, png))

with open("pic.png", "wb") as f:
    f.write(flag)
```

</details>

### CTRIME

> **Mục tiêu:** Khai thác nén + CTR (CRIME-style length oracle).

![image](https://hackmd.io/_uploads/H1Oeca2tyl.png)
*Hình: CTRIME challenge.*

![image](https://hackmd.io/_uploads/Sy7bq6nF1l.png)
*Hình: Flow nén rồi mã hóa.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
import requests

def encrypt(plaintext):
    url = "https://aes.cryptohack.org/ctrime/encrypt/" + plaintext.hex() + "/"
    return requests.get(url).json()['ciphertext']

flag = b'crypto{'
while b'}' not in flag:
    check = encrypt(flag)
    for c in range(32, 127):
        tmp = encrypt(flag + bytes([c]))
        if len(tmp) == len(check):
            flag += bytes([c])
            print(flag)
            break
```

</details>

### Logon Zero

> **Mục tiêu:** Khai thác reset password với token có 4 byte length cuối.

![image](https://hackmd.io/_uploads/BJ0zqT2Kyg.png)
*Hình: Logon Zero challenge.*

<details>
<summary>Bấm để xem Script Giải</summary>

```python
from pwn import *
import json

host = "socket.cryptohack.org"
port = 13399
r = remote(host, port)

def reset_password():
    conn = {'option': 'reset_password', 'token': "00" * 28}
    r.sendline(json.dumps(conn))
    print(r.recvline().decode())

def reset_connection():
    conn = {'option': 'reset_connection'}
    r.sendline(json.dumps(conn))
    print(r.recvline().decode())

def authenticate():
    conn = {'option': 'authenticate', 'password': ''}
    r.sendline(json.dumps(conn))
    resp = r.recvline().decode()
    print(resp)
    return resp

tmp = ''
while 'crypto' not in tmp:
    tmp = authenticate()
    reset_connection()
    reset_password()

print(tmp)
```

</details>
