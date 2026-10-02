---
date: 2026-07-13
summary: A practical overview of mTLS, PKI components, X.509 certificates, and how mutual authentication is deployed in real systems.
tags:
  - mtls
  - tls
  - pki
  - x509
---

# mTLS - Mutual Transport Layer Security
> Nguyen Trong Nhan - 24521236 |
> ---

> Toàn bộ thư mục ở: https://github.com/Nhan-Laptop/mTLS---Mutual-Transport-Layer-Security

## Overview and Motivation

Để đáp ứng như cầu chuyển đổi số ngày càng phát triển, nhiều giao thức bảo mật an toàn đã được ra đời, và theo đó là sự ra đời của **TLS** - **mTLS**.

Tổng quan về giao thức bảo mật mở rộng **mTLS**, yêu cầu máy khách và máy chủ luôn phải trao đổi - xác thực lẫn nhau. Các khái niệm và môn phỏng xuyên suốt quá trình trao đổi chứng thư - xác thực giữa 2 bên - "client & server": 

1. mTLS (Mutual Transport Layer Security).
2. CA (Certificate Authority).
3. Certificate.
4. RA (Registration Authority).
5. CSR (Certificate Signing Request).
6. Mối liên hệ giữa mTLS – CA – RA – CSR
7. Triển khai Hệ thống mTLS Đa Thuật toán (ECDSA & ML-DSA) và Hạ tầng PKI Kháng Lượng tử trên nền tảng OpenSSL 

---

## 1. mTLS (Mutual Transport Layer Security) 

### 1.1 Khái niệm 

mTLS là mở rộng của TLS, trong đó cả client và server đều xác thực lẫn nhau bằng chứng thư số X.509, không chỉ server chứng minh danh tính với client (như HTTPs thông thường), mà client cũng phải trình chứng thư hợp lệ. 

### 1.2 Cơ chế hoạt động

1. Client khởi tạo kết nối TLS. 

![image](https://hackmd.io/_uploads/BJG0_yYQbx.png)

2. Server gửi chứng thư số của mình. 
3. Client kiểm tra chứng thư của server (Chuỗi CA, thời hạn, etc...).

![image](https://hackmd.io/_uploads/rkbyFJtQWg.png)

4. Server yêu cầu client gửi chứng thư số.
5. Client gửi chứng thư + chứng minh sở hữu private key (ký handshake). 
6. Server xác thực chứng thư của client. 

![image](https://hackmd.io/_uploads/HkGxYkFQZg.png)

7. Hai bên thiết lập mã hóa an toàn. 

![image](https://hackmd.io/_uploads/HkjlKyK7Ze.png)

---

## 2. CA (Certificate Authority)

### 2.1 Khái niệm

**CA** là tổ chức/tổ hợp kỹ thuật chịu trách nhiệm phát hành, ký, gia hạn và thu hồi chứng thư số, CA là root of trust trong hạ tầng PKI 

![image](https://hackmd.io/_uploads/B1f25JYXWe.png)

### 2.2 Phân cấp CA

- **Root CA**: tin cậy tuyệt đối, khóa riêng được bảo vệ nghiêm ngặt (Offline).
- **Intermediate/Sub CA**: phát hành chứng thư cho người dùng, dịch vụ. 

![image](https://hackmd.io/_uploads/BkEC51Km-e.png)


### 2.3 Chức năng chính

- Ký chứng thư số X.509.
- Phát hành CRL (Certificate Revocation List). 
- Hỗ trợ OCSP responder. 
- Quản lý chính sách chứng thư (CP/CPS).

![image](https://hackmd.io/_uploads/HJy1iJFX-l.png)


---

## 3. Certificate

### 3.1 Khái niệm về Certificate

Certificate (chứng thư số) là một cấu trúc dữ liệu điện tử theo chuẩn X.509, do CA phát hành, nhằm xạc nhận rằng: 
- Một public key cụ thể thuộc một chủ thật đã được xác thực danh tính. 

Certificate đóng vai trò như "CMND/CCCD điện tử" trong một số môi trường ảo.

### 3.2 Cấu trúc Certificate X.509
Một cert X.509 bao gồm 3 phần chính: 

#### 1. Thông tin định danh (TBSCertificate)
- Version: phiên bản X.509 (v3 phổ biến nhất).
- Serial Number: Số seri duy nhất do CA cấp.
- Signature Algorithm: Thuật toán ký của CA (ECDSA, EdDSA,...).
- Issuer: Danh tính CA phát hành.
- Validity: Thời hạn hiệu lực (Not Before/Not After).
- Subject: Danh tính chủ thể sở hữu certificate.
- Subject Public Key Info: public key + thuật toán.

#### 2. Extensions (X.509 v3)
Một số extensions quan trọng: 
- Key Usage: Chỉ ra mục đích sử dụng (Digital Signature, Key Encipherment,...).
- Extended Key Usage (EKU): TLS client auth, server auth, code signing....
- Basic Constraints: CA = TRUE/FALSE.
- CRL Distribution Points: URL tải CRL.
- Authority Information Access (AIA): OCSP URL.
- Subject Alternative Name (SAN): DNS, IP, email...

#### 3. Chữ ký số CA

Toàn bộ TBSCertificate được CA ký bằng private key của CA, tạo thành chữ ký số xác thực certificate.

### 3.3. Phân loại Certificate 

![image](https://hackmd.io/_uploads/HJWvt4t7Zl.png)

### 3.4. Vòng đời của Certificate

![image](https://hackmd.io/_uploads/r1qm5EFXWg.png)

### 3.5 Vai trò của Certificate trong mTLS

Trong Mutual TLS, certificate được dùng để:

- Server chứng minh danh tính với client.

- Client chứng minh danh tính với server.

- Thiết lập khóa phiên an toàn.

=> Certificate là nền tảng của xác thực hai chiều.

---

## 4. RA (Registration Authority)

### 4.1 Khái niệm 

**RA** là đơn vị trung gian giữa người đăng ký và CA, chịu trách nhiệm xác thực danh tính trước khi CA cấp chứng thư. 

![image](https://hackmd.io/_uploads/H1mOnkFQZl.png)

### 4.2 Nhiệm vụ chính

- Tiếp nhận hồ sơ đăng ký chứng thư. 
- Xác minh danh tính (KYC, eID, CCCD, sinh trắc học).

![image](https://hackmd.io/_uploads/SJ6uhkFQbg.png)		

- Phê duyệt hoặc từ chối yêu cầu cấp chứng thư. 
- Ghi log, audit và tuân thủ quy trình phấp lý.

![image](https://hackmd.io/_uploads/B1j5hkYmWl.png)

---

## 5. CSR (Certificate Signing Request)

### 5.1 Khái niệm 

**CSR** là một gói dữ liệu do chủ thể (Client/server) tạo, gửi tới CA để xin cấp chứng thư số. 

![image](https://hackmd.io/_uploads/B194pyFQWg.png)

### 5.2 Nội dung CSR

Một CSR thường chứa: 

- Public key.
- Subject DN (CN, O, OU, C,...).
- Extensions (Key Usage, EKU).
- Chữ ký số bằng private-key tương ứng. 

![image](https://hackmd.io/_uploads/ByxOTkKQWe.png)


### 5.3 Quy trình CSR 

1. Chủ thể sinh cặp khóa (private/public).
2. Tạo CSR và ký bằng private key.

![image](https://hackmd.io/_uploads/rJGqp1K7Ze.png)

3. Gửi CSR đến RA. 
4. RA xác thực thông tin.
5. CA ký và phát hành certificate.

![image](https://hackmd.io/_uploads/B1u3p1tQWg.png)

### 5.4 Ý nghĩa bảo mật

- Private key không bao giờ rời khỏi thiết bị.
- CA chỉ xác nhận publickey + danh tính.

![image](https://hackmd.io/_uploads/B1VgA1F7-e.png)

---
	
## 6. Mối liên hệ giữa mTLS – CA – RA – CSR

Tạo thành chuỗi tin cậy: 
1. Client/Server tạo **CSR**. 
2. **RA** xác thực danh tính.
3. **CA** ký và phát hành chứng thư.

![image](https://hackmd.io/_uploads/SJ5c1etXWe.png)

Chứng thư được dùng trong **mTLS**, ký số, OCSP, TSA: 

![image](https://hackmd.io/_uploads/SyHAkgYmWe.png)

Nếu RA sai → CA ký sai:

![image](https://hackmd.io/_uploads/BJlxexK7Wg.png)

=> mTLS & chữ ký số mất giá trị pháp lý:

![image](https://hackmd.io/_uploads/B1ZbgeKQWg.png)

---

## 7. Triển khai Hệ thống mTLS Đa Thuật toán (ECDSA & ML-DSA) và Hạ tầng PKI Kháng Lượng tử trên nền tảng OpenSSL

### 7.1 kiến thức nền 

ECDSA (Elliptic Curve Digital Signature Algorithm): 
- **Cơ chế**: Dựa trên đường cong Elliptic trên trường hữu hạn.
- **Tham số**: prime256v1 (NIST P-256).
- **Lý thuyết**: https://en.wikipedia.org/wiki/Elliptic-curve_cryptography

ML-DSA (Module-Lattice Digital Signature Algorithm): 
- **Khái niệm**:  Là một lược đồ chữ ký dựa trên lưới (lattice-based), cụ thể là bài toán Module Learning With Errors (ML-WE) và Module Short Integer Solution (M-SIS).
- **Cơ chế**: Độ khó dựa trên việc tìm vectơ ngắn nhất trong một lưới đa chiều, một bài toán được cho là khó ngay cả với máy tính lượng tử.
- Tham số:
	- ML-DSA-44 (Cấp độ 2): Tương đương AES-128.
	- ML-DSA-65 (Cấp độ 3): Tương đương AES-192 (Sử dụng cho Cấp phát Dịch vụ).
	- ML-DSA-87 (Cấp độ 5): Tương đương AES-256 (Sử dụng cho Root CA).

- **Lý thuyết**:https://csrc.nist.gov/pubs/fips/204/final

### 7.2 Yêu cầu kĩ thuật

- Ubuntu 22.04/24.04 LTS hoặc tương đương: https://ubuntu.com/download/desktop.
-  OpenSSL 3.x: https://openssl-library.org/news/openssl-3.0-notes/index.html.
-  Thư viện liboqs: https://github.com/open-quantum-safe/liboqs.git.

### 7.3 Kiến trúc PKI và hệ thống lưu trữ khóa (Key Storage)

Mô phỏng hardward Security Module (HSM) mếm và quy trình RA logic -> đáp ứng nhu cầu phân cấp thiết kế nghiêm ngặt. 

#### 1. Cấu trúc Thư mục phân cấp: 

Tạo RA (ngoại tuyến) và Intermediate CA (Trực tuyến/cấp phát): 
```py!
mkdir -p pki/{root-ca,inter-ca,end-users}/{private,certs,csr,crl,newcerts}
chmod 700 pki/*/private
touch pki/root-ca/index.txt pki/inter-ca/index.txt
echo 1000 > pki/root-ca/serial
echo 1000 > pki/inter-ca/serial
```

#### 2. Giải pháp Lưu trữ Khóa (Key Storage Strategy):

Tạo giả lập lưu trữ phần cứng (HSM): 
- **Lưu trữ vật lý (mô phỏng)**: SoftHSMv2 qua giao diện PKCS#11. 
- Lưu trữ file mã hóa (Encrypted PEM): Dành cho các khóa CA nếu không dùng SoftHSM, được mã hóa bằng AES-256.

```py!
nhanlaptop@DESKTOP-JKAR60A:~/softhsm$ tree
.
├── conf
└── tokens
    └── 209aa402-8469-d728-6a36-4b2c37fefd23
        ├── generation
        ├── token.lock
        └── token.object

2 directories, 4 files
```

### 7.4 Triển khai Tuyến A: Hệ thống ECDSA (Tiêu chuẩn Hiện tại)

#### 1. Khởi tạo Root CA (ECDSA)

Sử dụng đường cong prime256v1 (NIST P-256)

- Tạo Khóa riêng cho Root CA (lưu trữ an toàn, mã hóa AES-256):
```py!
openssl ecparam -name prime256v1 -genkey -noout | openssl pkey -aes256 -out pki/root-ca/private/ca-ecdsa.key
```
- Tự ký chứng chỉ Root:

```py!
openssl req -new -x509 -days 3650 -sha256 \
    -key pki/root-ca/private/ca-ecdsa.key \
    -out pki/root-ca/certs/ca-ecdsa.crt \
    -subj "/C=VN/ST=HOCHIMINH/O=PQC Research/CN=QuantumSafe Root CA (ECDSA)"
```

#### 2. Khởi tạo Intermediate CA (ECDSA)

Intermediate CA dùng để ký chứng chỉ dịch vụ, giúp bảo vệ Root CA offline.

- Tạo khóa Intermediate: 

```py!
openssl ecparam -name prime256v1 -genkey -noout \
    -out pki/inter-ca/private/inter-ecdsa.key
```

- Tạo yêu cầu ký chứng chỉ (CSR) - RA nhận file này: 

```python!
openssl req -new -sha256 \
    -key pki/inter-ca/private/inter-ecdsa.key \
    -out pki/inter-ca/csr/inter-ecdsa.csr \
    -subj "/C=VN/ST=HOCHIMINH/O=PQC Research/CN=QuantumSafe Inter CA (ECDSA)"
```

- Root CA ký cho Intermediate CA: 

```python!
openssl x509 -req -days 1825 -sha256 \
    -in pki/inter-ca/csr/inter-ecdsa.csr \
    -CA pki/root-ca/certs/ca-ecdsa.crt \
    -CAkey pki/root-ca/private/ca-ecdsa.key \
    -CAcreateserial \
    -out pki/inter-ca/certs/inter-ecdsa.crt \
    -extfile <(echo "basicConstraints=critical,CA:TRUE,pathlen:0")
```

### 7.5 Triển khai Tuyến B: Hệ thống ML-DSA (Hậu Lượng Tử)

Ở đây chúng ta sẽ sử dụng: 
- Root CA: ML-DSA-87 độ an toàn cao nhất. 
- Intermediate/Service: Sử dụng ML-DSA-65 - tương đương với Dilithium level 3. 

#### 1. Khởi tạo Root CA (ML-DSA-87)

- Tạo khóa riêng PQC: 

```python!
openssl genpkey -algorithm mldsa87 \
    -out pki/root-ca/private/ca-mldsa.key
```

- Tự ký chứng chỉ Root PQC:

```python!
openssl req -new -x509 -days 3650 \
    -key pki/root-ca/private/ca-mldsa.key \
    -out pki/root-ca/certs/ca-mldsa.crt \
    -subj "/C=VN/ST=Hanoi/O=PQC Research/CN=QuantumSafe Root CA (ML-DSA)" \
    -config /usr/local/ssl/openssl.cnf
```

#### 2. Khởi tạo Intermediate CA (ML-DSA-65)

- Tạo khóa Intermediate (Level 3): 

```python!
openssl genpkey -algorithm mldsa65 \
    -out pki/inter-ca/private/inter-mldsa.key
```

- Tạo CSR:

```python!
openssl req -new \
    -key pki/inter-ca/private/inter-mldsa.key \
    -out pki/inter-ca/csr/inter-mldsa.csr \
    -subj "/C=VN/ST=HOCHIMINH/O=PQC Research/CN=QuantumSafe Inter CA (ML-DSA)"
```

- Root CA (ML-DSA-87) ký cho Intermediate (ML-DSA-65):

```py!
openssl x509 -req -days 1825 \
    -in pki/inter-ca/csr/inter-mldsa.csr \
    -CA pki/root-ca/certs/ca-mldsa.crt \
    -CAkey pki/root-ca/private/ca-mldsa.key \
    -CAcreateserial \
    -out pki/inter-ca/certs/inter-mldsa.crt \
    -extfile <(echo "basicConstraints=critical,CA:TRUE,pathlen:0")
```


### 7.6 Quy trình Cấp phát Chứng chỉ Dịch vụ (mTLS)

Trong mô hình mTLS, chúng ta có 2 dịch vụ: Service A (Server) và Service B (Client). Cả hai đều cần chứng chỉ định danh.

#### 1. Tạo File Cấu hình Extension (RA Policy
RA cần áp đặt các ràng buộc sử dụng khóa (Key Usage). Tạo file `service_ext.cnf`:

```python!
basicConstraints = CA:FALSE
nsCertType = server, client
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = service-a.internal
DNS.2 = localhost
IP.1 = 127.0.0.1
```

#### 2. Cấp phát Chứng chỉ cho Service A (Server) - Hybrid Approach

Ta cần cấp 2 chứng chỉ cho Service A: 

##### Chứng chỉ ECDSA (Legacy):
- Key & CSR: 
	- Key: `openssl ecparam -name prime256v1 -genkey -out pki/end-users/private/service-a-ecdsa.key`
	- CSR: `openssl req -new -key pki/end-users/private/service-a-ecdsa.key -out pki/end-users/csr/service-a-ecdsa.csr -subj "/CN=service-a.internal"`

-  RA/CA Ký: 

```python!
openssl x509 -req -in pki/end-users/csr/service-a-ecdsa.csr \
    -CA pki/inter-ca/certs/inter-ecdsa.crt \
    -CAkey pki/inter-ca/private/inter-ecdsa.key \
    -CAcreateserial -out pki/end-users/certs/service-a-ecdsa.crt -days 365 \
    -extfile service_ext.cnf
```

##### Chứng chỉ ML-DSA (Post-Quantum):

- Key & CSR:
	- Key: `openssl genpkey -algorithm mldsa65 -out pki/end-users/private/service-a-mldsa.key`
	- CSR: `openssl req -new -key pki/end-users/private/service-a-mldsa.key -out pki/end-users/csr/service-a-mldsa.csr -subj "/CN=service-a.internal"`

- RA/CA Ký:

```python!
openssl x509 -req -in pki/end-users/csr/service-a-mldsa.csr \
    -CA pki/inter-ca/certs/inter-mldsa.crt \
    -CAkey pki/inter-ca/private/inter-mldsa.key \
    -CAcreateserial -out pki/end-users/certs/service-a-mldsa.crt -days 365 \
    -extfile service_ext.cnf
```

#### 3. Cấp phát Chứng chỉ cho Service B (Client)
Tương tự, Service B nhận một cặp khóa ML-DSA để thực hiện xác thực phía client (Client Authentication).

```python!

openssl genpkey -algorithm mldsa65 -out pki/end-users/private/service-b-client.key
#--------------------------------------

openssl req -new -key pki/end-users/private/service-b-client.key \
    -out pki/end-users/csr/service-b-client.csr -subj "/CN=service-b-client"
#---------------------------------------

openssl x509 -req -in pki/end-users/csr/service-b-client.csr \
    -CA pki/inter-ca/certs/inter-mldsa.crt \
    -CAkey pki/inter-ca/private/inter-mldsa.key \
    -CAcreateserial -out pki/end-users/certs/service-b-client.crt -days 365 \
    -extfile service_ext.cnf
```

#### 4. Đóng gói Khóa (Key Container)
Để chuyển giao khóa cho ứng dụng một cách an toàn, cần sử dụng định dạng PKCS#12 (.p12).


Đóng gói cho Service A (ML-DSA):
```python!
openssl pkcs12 -export \
    -inkey pki/end-users/private/service-a-mldsa.key \
    -in pki/end-users/certs/service-a-mldsa.crt \
    -certfile pki/inter-ca/certs/inter-mldsa.crt \
    -out pki/end-users/service-a-mldsa.p12 \
    -name "ServiceA_QuantumID" -passout pass:123123123
```

### 7.7 Thiết lập Kết nối mTLS và Kiểm thử

#### Khởi chạy Service A (Server):

```python!
openssl s_server \
    -cert pki/end-users/certs/service-a-mldsa.crt \
    -key pki/end-users/private/service-a-mldsa.key \
	-cert2 pki/end-users/certs/service-a-mldsa.crt \
    -key2 pki/end-users/private/service-a-mldsa.key \
    -CAfile pki/inter-ca/certs/inter-mldsa.crt \
    -Verify 1 \
    -accept 4433 \
    -www
```

#### Kết nối từ Service B (Client):

```python!
openssl s_client \
    -connect localhost:4433 \
    -cert pki/end-users/certs/service-b-client.crt \
    -key pki/end-users/private/service-b-client.key \
    -CAfile pki/inter-ca/certs/inter-mldsa.crt
```


## References: 

1. https://github.com/open-quantum-safe/oqs-provider
2. https://developer.ibm.com/tutorials/awb-building-quantum-safe-web-applications/
3. https://www.erianna.com/ecdsa-certificate-authorities-and-certificates-with-openssl/
4. https://developer.ibm.com/tutorials/awb-quantum-safe-openssl/
5. https://medium.com/be-tech-with-santander/how-to-configure-post-quantum-cryptography-in-your-web-server-fcf79e05e526
6. https://docs.python.org/3/library/ssl.html
