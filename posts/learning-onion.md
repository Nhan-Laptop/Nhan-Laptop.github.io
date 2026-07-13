---
date: 2026-07-13
summary: A survey-style note on DoS against Tor onion services and why client puzzles are a fragile mitigation under anonymity constraints.
tags:
  - tor
  - onion-services
  - dos
  - client-puzzles
---

# Onions Got Puzzled: On the Challenges of Mitigating Denial-of-Service Problems in Tor Onion Services

> Nhan_laptop 
---

>In this blog, I will present the concept of DoS, its impact on Onion Services, and several experimental testbeds for this attack. 

>Main resources: https://www.usenix.org/conference/usenixsecurity25/presentation/lee

## Motivations and Overview.

As we know, in the Tor network, we cannot identify the source IP due to sender anonymity. Therefore, if a denial-of-service (DoS) attack occurs, how can we prevent it?

In 2023, given the persistent risks of DoS attacks on Tor onion services and the technical difficulties in applying traditional DoS defenses, the Tor community officially recommended the adoption of client puzzles in August 2023 to mitigate specific types of DoS attacks, including introduction-flooding attacks.

However, there are essential vulnerabilities in the current client puzzle solution for Tor onion services.

Attacks on the current client puzzle mechanism in the Tor network are cheaper and more efficient than similar attacks on normal networks.

What has happened, and why did it occur? This appears to contradict the expected security level of the Tor network.

## **Denial-of-service attack (DoS)**

resource: 

- https://www.cloudflare.com/learning/ddos/glossary/denial-of-service/
- https://en.wikipedia.org/wiki/Denial-of-service_attack

## Concept

![image](https://hackmd.io/_uploads/rJsPBFqhWe.png)


A denial-of-service (DoS) attack is a form of cyberattack in which a malicious actor attempts to render a computer system or device unavailable to its intended users by disrupting its normal operation. Such attacks typically operate by overwhelming the target with a high volume of requests, thereby preventing legitimate traffic from being processed and resulting in a denial of service to additional users. A DoS attack is generally characterized by being launched from a single source.

![image](https://hackmd.io/_uploads/Sy0qHFchWe.png)


A distributed denial-of-service (DDoS) attack is a variant of DoS in which the attack originates from multiple distributed sources, often coordinated through a botnet.

 

### Method

Some attacks we usually meet. 

#### **Buffer overflow attacks**

![image](https://hackmd.io/_uploads/SybhBKcnWe.png)


A buffer overflow occurs when a program writes more data to a memory buffer than it can hold, spilling over into adjacent memory, causing crashes or allowing code execution. As a [DoS attack](https://www.google.com/search?q=DoS+attack&sca_esv=232604508b79d53c&rlz=1C1GCEA_enVN1203VN1203&sxsrf=ANbL-n5m2dg692b9s_KkKLFWiDeQQevjJg%3A1775728561394&ei=sXfXabLbF7TLqfkPyv__-A4&biw=767&bih=695&ved=2ahUKEwjd9Mu4wOCTAxVFnGMGHeFFPMEQgK4QegQIARAB&uact=5&oq=the+concept+of+Buffer+overflow+attacks+of+DoS&gs_lp=Egxnd3Mtd2l6LXNlcnAiLXRoZSBjb25jZXB0IG9mIEJ1ZmZlciBvdmVyZmxvdyBhdHRhY2tzIG9mIERvUzIFEAAY7wUyBRAAGO8FMggQABiiBBiJBTIFEAAY7wVIpCRQ-xBY8SJwA3gBkAEBmAGIBKABwBOqAQgyLjExLjUtMrgBA8gBAPgBAZgCCqACxgbCAgoQABiwAxjWBBhHmAMAiAYBkAYIkgcDMy43oAeCQrIHAzAuN7gHvQbCBwQwLjEwyAcPgAgA&sclient=gws-wiz-serp), this technique **floods a system with excessive data to consume memory, causing software instability or system failure**

#### Flood attacks
![image](https://hackmd.io/_uploads/B1Z6HK5nZx.png)


Flood attacks in Denial-of-Service (DoS) are **cyberattacks that overwhelm a target system (server, network, or application) with an excessive volume of traffic, rendering it unavailable to legitimate users**. By saturating bandwidth or consuming system resources, these attacks force services to become slow or completely unresponsive

### **ICMP flood**

![image](https://hackmd.io/_uploads/S1fy8Yc3Zl.png)



An ICMP flood, commonly known as a **ping flood**, is a type of Denial-of-Service (DoS) or Distributed Denial-of-Service (DDoS) attack in which an attacker attempts to overwhelm a target device with an immense volume of ICMP Echo Request packets (pings). 

The goal is to exhaust the target’s bandwidth and processing resources, making it unable to respond to legitimate network traffic.

Variations and Related Attacks: 

- **Smurf Attack:** A specific, older type of attack where the attacker sends ICMP packets with a **spoofed** (faked) source IP address (the victim's IP) to a network broadcast address. All devices on that network respond to the victim, magnifying the attack.
- **Ping of Death:** Attackers send oversized ICMP packets (>65,535 bytes). When reassembled, this causes a buffer overflow, which can freeze or crash older operating systems

### SYN flood

![image](https://hackmd.io/_uploads/r1xQx8Y5hWx.png)


A SYN flood is a type of [Denial-of-Service (DDoS) attack](https://www.google.com/search?q=Denial-of-Service+%28DDoS%29+attack&sca_esv=ac692c75a76bde75&rlz=1C1GCEA_enVN1203VN1203&biw=697&bih=663&sxsrf=ANbL-n6tRJnU4uoIsDCL0oYIr9nLupmROg%3A1775790150662&ei=RmjYaaaGKLW84-EPy9eu6QI&ved=2ahUKEwjd-MrMpuKTAxXqzzgGHYE3LDYQgK4QegQIARAB&uact=5&oq=the+concept+of+SYN+flood+&gs_lp=Egxnd3Mtd2l6LXNlcnAiGXRoZSBjb25jZXB0IG9mIFNZTiBmbG9vZCAyCBAAGIAEGKIEMggQABiABBiiBEjvFFAAWKcTcAB4AZABAJgBjwGgAZACqgEDMC4yuAEDyAEA-AEC-AEBmAICoAKeAsICBxAhGAoYoAGYAwCSBwMwLjKgB68DsgcDMC4yuAeeAsIHAzItMsgHB4AIAQ&sclient=gws-wiz-serp&mstk=AUtExfCxiD8aWR3xxaAfu-_TMzlv-3EVj8S3VjzNoZsc1OWpEu3tYjquylqg6Yh5wsPVDRCUXvlw79C-TB9N78uA2sPpogb71Xir3QZuKBtXLq5xJmvFE6DGWrAdg1XsjfQUIpEFIE0MGXhSS-oo0QoSOsQ9p_cWueT12vJRgsZihfaYzdTohK8ukoqbUZn8Vskv5TUvHSlAmG7IuVHmJumszIlVnvTNuVIYAyQAqt50pSl3tROO6FllhplsrScwSLe22Tazzl2_tWBUvGyN7tKoj5is&csui=3) that exploits the TCP three-way handshake to overwhelm server resources. Attackers send numerous SYN (synchronization) requests, often with spoofed IP addresses, but never send the final ACK (acknowledgment) packet, leaving connections "half-open". This consumes server capacity, preventing legitimate users from connecting

### DoS Mitigation Techniques

![image](https://hackmd.io/_uploads/r11fIF92Zg.png)


There are several techniques to prevent ( we cannot clearly protect our services from this attacks)  the above attacks, such as: 

- **Use Cloud-Based Mitigation Centers:** Services like Cloudflare, AWS Shield, or Akamai can absorb large-scale volumetric attacks by filtering traffic through distributed data centers.
- **Rate Limiting:** Restrict the number of requests a server accepts over a specific time window, which helps mitigate brute force and API-targeting DoS attempts.
- **Web Application Firewall (WAF):** Deploy a WAF to filter malicious HTTP traffic and protect against application-layer attacks (Layer 7).
- **Anycast Network Diffusion:** Utilize network providers that use Anycast to spread attack traffic across multiple servers, preventing a single server from becoming overwhelmed.
- [**Identify and Filter Traffic](https://www.google.com/search?q=Identify+and+Filter+Traffic&sca_esv=ac692c75a76bde75&rlz=1C1GCEA_enVN1203VN1203&biw=697&bih=663&sxsrf=ANbL-n7KoWOhwdhTxtmeO1nuy0u9QikLTA%3A1775790359294&ei=F2nYaanYEbip4-EPkub7kAs&oq=Ho&gs_lp=Egxnd3Mtd2l6LXNlcnAiAkhvKgIIADIEECMYJzIHECMY8AUYJzIEECMYJzIIEAAYgAQYsQMyCxAAGIAEGLEDGIMBMggQLhiABBixAzIIEAAYgAQYsQMyCBAuGIAEGLEDMggQLhiABBixAzILEAAYgAQYigUYsQNIsxhQAFiVCnAGeAGQAQSYAcMBoAH5CaoBAzEuN7gBA8gBAPgBAZgCCqAC1AXCAgsQABiABBiKBRiRAsICBRAuGIAEwgIFEAAYgATCAhAQABiABBiKBRhDGLEDGIMBwgIKEAAYgAQYigUYQ8ICEBAuGIAEGIoFGEMYsQMYgwHCAg0QABiABBiKBRhDGLEDwgIKEC4YgAQYigUYQ8ICEBAuGIAEGIoFGEMYxwEY0QOYAwCSBwM2LjSgB5lksgcDMC40uAesBcIHBTItOS4xyAc9gAgB&sclient=gws-wiz-serp&mstk=AUtExfBF9HgHMcS2fh8mr7H0ItlGSE1jA8yFLL59-22mRZUcReYTDrU-AXL_O6D9lyyGXmBJALD1C8J1u3FLxlHG-2tnZUBOqE2xX-mWB6VBrPV4WQs_CmzvUn8KEDl53t19EkUGq2aJ3uNjKzTWzI7wKeQ1aOxkTh979jpEucztXLDgvfyxiCG6Ua1qY1z0TUs2I3UvVXzeJj7reu-4w7aXwNgXY2Pzs_kgtHcWLYKrHWo8sADcolaRYHckpfWPVQLSHA3C4hk2MonXKTCxLzYG_Ghk&csui=3&ved=2ahUKEwiz-N7vp-KTAxUI1DgGHQNFPXYQgK4QegQIAxAF):** Use tools to analyze traffic patterns in real-time, identifying abnormal requests or "bad traffic" to block.
- [**Reduce the Attack Surface](https://www.google.com/search?q=Reduce+the+Attack+Surface&sca_esv=ac692c75a76bde75&rlz=1C1GCEA_enVN1203VN1203&biw=697&bih=663&sxsrf=ANbL-n7KoWOhwdhTxtmeO1nuy0u9QikLTA%3A1775790359294&ei=F2nYaanYEbip4-EPkub7kAs&oq=Ho&gs_lp=Egxnd3Mtd2l6LXNlcnAiAkhvKgIIADIEECMYJzIHECMY8AUYJzIEECMYJzIIEAAYgAQYsQMyCxAAGIAEGLEDGIMBMggQLhiABBixAzIIEAAYgAQYsQMyCBAuGIAEGLEDMggQLhiABBixAzILEAAYgAQYigUYsQNIsxhQAFiVCnAGeAGQAQSYAcMBoAH5CaoBAzEuN7gBA8gBAPgBAZgCCqAC1AXCAgsQABiABBiKBRiRAsICBRAuGIAEwgIFEAAYgATCAhAQABiABBiKBRhDGLEDGIMBwgIKEAAYgAQYigUYQ8ICEBAuGIAEGIoFGEMYsQMYgwHCAg0QABiABBiKBRhDGLEDwgIKEC4YgAQYigUYQ8ICEBAuGIAEGIoFGEMYxwEY0QOYAwCSBwM2LjSgB5lksgcDMC40uAesBcIHBTItOS4xyAc9gAgB&sclient=gws-wiz-serp&mstk=AUtExfBF9HgHMcS2fh8mr7H0ItlGSE1jA8yFLL59-22mRZUcReYTDrU-AXL_O6D9lyyGXmBJALD1C8J1u3FLxlHG-2tnZUBOqE2xX-mWB6VBrPV4WQs_CmzvUn8KEDl53t19EkUGq2aJ3uNjKzTWzI7wKeQ1aOxkTh979jpEucztXLDgvfyxiCG6Ua1qY1z0TUs2I3UvVXzeJj7reu-4w7aXwNgXY2Pzs_kgtHcWLYKrHWo8sADcolaRYHckpfWPVQLSHA3C4hk2MonXKTCxLzYG_Ghk&csui=3&ved=2ahUKEwiz-N7vp-KTAxUI1DgGHQNFPXYQgK4QegQIAxAH):** Limit exposure by hiding origin servers behind CDNs or load balancers, restricting direct access to critical infrastructure

## Tor Network - Onion Services

### The basic architecture of Tor Network

Tor is a distributed overlay network designed to anonymize low-latency TCP-based applications such as web browsing, secure shell, and instant messaging. The network is built of a number of servers, called **relays** (also called “onion routers” or “ORs” in some older documentation).

To connect to the network, a client needs to download an up-to-date signed directory of the relays on the network. These directory documents are generated and signed by a set of semi-trusted **directory authority** servers, and are cached by the relays themselves. (If a client does not yet have a directory, it finds a cache by looking at a list of stable cache locations, distributed along with its source code.)

When you want to access a regular website (the clear web) through Tor, your data does not travel directly. Instead, it is wrapped in three layers of encryption, like three layers of an onion, and passes through a “circuit” consisting of three randomly selected relay nodes:

- **Guard Node (Entry Node):** This is the first relay. It knows your real IP address, but it is blind to the content you are sending and does not know where you want to go, because the data is encrypted.
- **Middle Node:** This relay receives data from the Guard Node and forwards it onward. It does not know who you are, does not know your IP address, and also does not know the final destination. It only knows the relay before it and the relay after it.
- **Exit Node:** This is the last relay. It removes the final layer of encryption and sends your request to the destination website (for example, facebook.com). The destination website will think that the Exit Node is you, and it will have no knowledge of your real IP address.

![image](https://hackmd.io/_uploads/ryR7Ltq2We.png)


In short, the core idea of the Tor network is to distribute trust. No single node in the network has the full picture of both who you are and what you are doing

### Onion Services

If the ordinary Tor network helps users remain anonymous when accessing the web, then Onion Services (formerly called Hidden Services) take it one step further: they keep both the user and the service provider anonymous.

These are the websites with the `.onion` domain. Unlike regular websites, they are not hosted on any fixed IP address that everyone can see.

**The Rendezvous Protocol** — how the client and server find each other:

Because neither side knows the other’s IP address, how do they connect? Tor creates a kind of “shady matchmaking” mechanism in six steps. This is the part that our project (OnionFlation) is attacking:

![image](https://hackmd.io/_uploads/rkFwUY92Wl.png)


- **Setting up Introduction Points (IPs):** The Onion Service (the server) selects several random nodes on the Tor network to act as its “ambassadors.” The server builds Tor circuits to these nodes and says, “If anyone wants to find me, send a message through here.”
- **Publishing the Descriptor:** The server creates a descriptor containing the list of these Introduction Points (and, if it is under attack, a proof-of-work requirement as well!). The server signs it and uploads it to the directory servers.
- **Client lookup:** When you enter a `.onion` address in your browser, the Tor client downloads that descriptor to learn which Introduction Points it should contact.
- **Creating a Rendezvous Point (RP):** The client randomly selects a node on the Tor network to serve as the “meeting point.” It builds a circuit to that node and gives it a secret value called a rendezvous cookie.
- **Sending the Introduction (Introduction Phase — THIS IS WHERE WE ATTACK):** The client builds a circuit to the server’s Introduction Point and sends an Introduce message. This message contains the location of the rendezvous point (RP), the secret cookie, and, importantly, the result of your proof-of-work computation.
- **Rendezvous:** The server receives the introduction through the Introduction Point and verifies that the proof of work is valid. If everything checks out, the server builds a circuit to the rendezvous point chosen by the client and presents the secret cookie. The two sides connect successfully and begin exchanging end-to-end encrypted data through this rendezvous point.

### Challenges of the Rendezvous Protocol 

The rendezvous protocol is a core component of Tor onion services. It allows both the client and the onion service to remain anonymous: the client does not learn the real network location of the service, and the service does not learn the real IP address of the client. However, this anonymity-first design also creates a major security challenge: if the service cannot identify who is sending requests, how can it defend itself against DoS or DDoS attacks?

In conventional Internet services, DoS/DDoS mitigation often relies on identifying, filtering, or challenging suspicious traffic sources. These techniques are difficult to apply to Tor onion services because the service only receives introduction requests through Tor relays and cannot directly attribute them to real clients. In particular, introduction-flooding attacks abuse the rendezvous protocol by forcing the onion service to process a large number of introduction requests and establish excessive rendezvous circuits, which can exhaust the service’s resources.

This creates several limitations:

![image](https://hackmd.io/_uploads/ryySvGi0Zl.png)

- **Source-based filtering is ineffective:** the service cannot distinguish attackers from legitimate anonymous users.
- **Rate limiting is limited:** introduction points can limit total request rates, but the onion service cannot easily rate-limit per real client.
- **Replication and scaling are difficult:** adding more onion service instances must preserve receiver anonymity and cannot always react quickly to sudden attack traffic.
- **CAPTCHA is too late:** the service can only show a CAPTCHA after a rendezvous circuit has been established, meaning the expensive introduction step has already happened.
- **WAF and bot detection are less reliable:** many signals used by normal web defenses, such as IP reputation, browser fingerprinting, or user identity, are unavailable or privacy-sensitive in Tor.

### The mitigation for DOS attack 

Because traditional DoS mitigation techniques are difficult to apply to Tor onion services, Tor adopts a different approach: **Proof-of-Work (PoW)**, also known as a **client puzzle**. The main idea is not to identify whether a client is legitimate or malicious, because doing so would break Tor’s anonymity model. Instead, the system forces every client to spend a small amount of computational work before its introduction request is prioritized.

This mechanism helps reduce the asymmetry between attackers and defenders. In a normal DoS attack, an attacker can cheaply generate a large number of requests, while the service must spend significantly more resources to process them. With client puzzles, each request requires computational effort from the client. A legitimate user only solves a small number of puzzles, so the overhead is acceptable. In contrast, an attacker who wants to send thousands of introduction requests must solve thousands of puzzles, making the attack much more expensive.

In Tor onion services, the mitigation works as follows:
![image](https://hackmd.io/_uploads/BkkSqzs0Zl.png)


1. **The onion service publishes puzzle parameters**
   
   The onion service periodically publishes a descriptor through Tor directory servers. This descriptor contains information such as a puzzle seed, a service-specific identity string, and the suggested puzzle difficulty.

2. **The client solves a puzzle before sending an introduction request**
   
   Before contacting the onion service, the client downloads the descriptor and solves a cryptographic puzzle based on the published parameters. The higher the suggested difficulty is, the more computation the client must perform.

3. **The introduction request carries the puzzle solution**
   
   After solving the puzzle, the client attaches the puzzle solution to its introduction request and sends it through an Introduction Point.

4. **The onion service verifies the solution**
   
   When the onion service receives the request, it verifies the puzzle solution. Verification is much cheaper than solving the puzzle, so the service can check many solutions with relatively low cost.

5. **Requests are placed into a priority queue**
   
   Valid requests are inserted into a priority queue. Requests with higher puzzle difficulty receive higher priority. This means that during congestion, clients who spend more computational work are handled first.

6. **The service adjusts puzzle difficulty dynamically**
   
   The onion service uses a Difficulty Update Algorithm (DUA) to change the suggested puzzle difficulty based on the queue status. If the system detects congestion, the difficulty increases. If the queue becomes nearly empty, the difficulty decreases.

The benefit of this approach is that it preserves anonymity. The onion service does not need to know the client’s IP address, identity, location, or reputation. It only checks whether the client has performed enough computational work. This makes PoW more compatible with Tor than IP blocking, CAPTCHA, cloud firewalls, or traditional rate limiting.

Although client puzzles are currently the most practical DoS mitigation for Tor onion services, recent research shows that the difficulty update mechanism itself can become a new attack surface. The ONIONFLATION attack manipulates the service into increasing the suggested puzzle difficulty for all clients, even when the service is not truly congested. As a result, legitimate clients are forced to solve unnecessarily difficult puzzles, causing long waiting times or timeouts.

Therefore, the problem is not simply “using PoW or not.” The real challenge is designing a difficulty update algorithm that can balance two goals: resisting real congestion attacks and avoiding artificial difficulty inflation.


## DUA (Denial-of-service (DoS) Use and Abuse mitigation) Algorithm

### Current Onion Puzzle Design
Overview of the client puzzle mechanism in Tor
onion services: 
![image](https://hackmd.io/_uploads/r1r99GsCZg.png)
Illustration of the current difficulty update algorithm: 
![image](https://hackmd.io/_uploads/SJk-oGjRZx.png)

#### state

$D_{sug}[n]$: The suggested puzzle difficulty at round n.

$D_{max−trim}[n]$$: The highest puzzle difficulty of trimmed requests during round n
- Trimming can occur when requests that are too
old (i.e., enqueued more than 15 seconds earlier) are dequeued.
- The queue reaches its capacity (i.e., 16,384 or 17,500 requests, depending on the configuration
$\rightarrow$ the service discards half of the queue.

$\sum{D_{enqueued}[n]}$: The sum of all puzzle difficulties of enqueued requests during round n.

$rend_{handled}[n]$: The number of handled requests during round n.

$flag_{congestion}$: A flag which is set if the priority queue is filled with a certain number of requests (i.e., 16 or 63 requests, depending on the configuration).
- It is unset at the start of each round.

### decision



\begin{array}{l}
\text{at the end of each update round, the service} \\
1:\ \textbf{if}\ D_{max-trim}[n] > D_{sug}[n]\ \textbf{then} \\
\qquad \text{increases the suggested difficulty} \\
2:\ \textbf{else if}\ flag_{congestion}\ \textbf{then} \\
3:\qquad \textbf{if}\ \text{at least one request remains whose puzzle difficulty is} \\
\qquad D_{sug}[n]\ \text{or high}\ \textbf{then} \\
4:\qquad\qquad \text{increases the suggested difficulty} \\
5:\qquad \textbf{end if} \\
6:\ \textbf{else if}\ \text{the current number of requests in the queue is below a} \\
\qquad \text{threshold (i.e., 16 or 63 requests, depending on the configura-} \\
\qquad \text{tion)}\ \textbf{then} \\
7:\qquad \text{decreases the suggested difficulty} \\
8:\ \textbf{else} \\
9:\qquad \text{maintains the suggested difficulty} \\
10:\ \textbf{end if} \\[8pt]
\textbf{increase:} \\
D_{sug}[n+1]
\leftarrow
\max\!\left(
\frac{\sum D_{enqueued}[n]}
     {rend_{handled}[n]},
D_{sug}[n] + 1
\right)
\\[10pt]
\textbf{decrease:} \\
D_{sug}[n+1]
\leftarrow
\frac{2}{3}\times D_{sug}[n]
\end{array}

## The ONIONFLATION Attack

The weakness comes from the design of the current DUA. By following the algorithm, we can observe several important issues:
![image](https://hackmd.io/_uploads/r1UQW7oC-x.png)

- **The DUA only updates the difficulty at the end of each update round.**  
  This means the onion service does not react immediately to the real-time condition of the queue. Instead, it waits until the end of a round and then decides whether to increase, decrease, or maintain the suggested difficulty.

- **The congestion flag can be triggered by a small number of requests.**  
  In the current design, `flag_congestion` can be turned on when the priority queue reaches a certain threshold. An attacker can exploit this by sending carefully timed requests to make the service believe that congestion is happening.

- **The DUA only observes symptoms of congestion, not the real cause.**  
  The algorithm checks queue status, such as whether requests remain in the queue or whether requests are trimmed. However, it cannot know whether the queue state was caused by a real DoS attack or by a small burst of manipulated requests.

- **The suggested difficulty is global for all clients.**  
  Once the onion service increases the suggested puzzle difficulty, the new value is announced through directory servers and applied to all clients. Therefore, a successful attacker can make every legitimate client solve harder puzzles.


The ONIONFLATION attack consists of four main strategies:
- End-rush attack. 
- Temporary-turmoil attack.
- Choking attack.
- Maintenance attack.

![image](https://hackmd.io/_uploads/SkdAmQjAbl.png)



### 1. **End-rush attack**

   In this strategy, the attacker waits until the end of an update round and then sends a small burst of high-difficulty introduction requests. The purpose is to leave at least one high-difficulty request unhandled when the round ends. Since the DUA sees both `flag_congestion` and a remaining valuable request in the queue, it increases the suggested puzzle difficulty for the next round.

   This attack is dangerous because it requires only a small number of carefully timed requests. The attacker does not need to flood the service continuously. Instead, the attacker only needs to send requests near the update time.


### 2. **Temporary-turmoil attack**

   This strategy exploits the formula used when the DUA increases the suggested difficulty. The attacker sends many relatively low-difficulty requests to fill the priority queue and trigger queue trimming. When the queue is trimmed, many requests are discarded, but their difficulty values may still affect the calculation of the next difficulty level.

   As a result, the DUA may compute a much higher suggested difficulty than what the attacker actually paid for. This causes an artificial inflation of the puzzle difficulty.

### 3. **Choking attack**

   After the difficulty has been inflated, the attacker can further reduce the service capacity. The attacker sends high-difficulty requests and leaves the corresponding rendezvous connections half-open. Since high-difficulty requests receive higher priority, the service spends its limited capacity on attacker-controlled requests.

   This makes legitimate clients unable to establish rendezvous circuits, even if they are honest users.

### 4. **Maintenance attack**

   Once the suggested difficulty has been inflated, the attacker needs to keep it high. Surprisingly, this can be done cheaply by sending only a small number of zero-difficulty requests. The current DUA may decide to maintain the difficulty if the queue is not almost empty, without considering whether the remaining requests actually have meaningful difficulty.

   Therefore, the attacker can maintain the inflated difficulty with very low computational cost.

## The Suggestion Update in DUA Algorithm
![image](https://hackmd.io/_uploads/BJoQE7sAbl.png)

The new DUA algorithm changes how the onion service updates the suggested puzzle difficulty. The main idea is simple: instead of checking small signs of congestion, such as whether the queue is almost full or whether some requests are still waiting, the new algorithm looks at the overall dequeue rate.

In other words, it focuses on this question:

> How many requests did the service actually handle during this round?

If the service is handling more requests than the target rate, the puzzle difficulty should increase. If the service is handling fewer requests than the target rate, the puzzle difficulty should decrease. This makes the update process more direct and more stable than the old DUA.

#### Main Parameters

The new DUA uses the following values:

* **Target dequeue rate `μ_target`**
  This is the ideal number of requests that the onion service wants to process in one second. For example, the service may want to handle around 100 requests per second.

* **Adjusting parameter `δ`**
  This value controls how sensitive the algorithm is. The default value is 1. If `δ > 1`, the algorithm reacts more slowly to traffic increases. This helps reduce the chance of fake difficulty inflation, but it may also make the system slower to respond to real congestion.

* **Suggested puzzle difficulty `D_sug[n]`**
  This is the puzzle difficulty suggested to clients in the current round `n`.

* **Total handled difficulty `ΣD_handled[n]`**
  This is the sum of the puzzle difficulties of all requests that were successfully handled during round `n`.

* **Number of handled requests `rend_handled[n]`**
  This is the number of requests that the onion service actually processed during round `n`.

#### Step 1: Calculate the adjusted processing rate

First, the algorithm calculates the adjusted dequeue rate:

```text
μ_adjust[n] = rend_handled[n] / (T_round × δ)
```

Here, `T_round` is the duration of one update round.

This value shows how many requests were processed per second, after applying the sensitivity parameter `δ`. If `δ` is larger, `μ_adjust` becomes smaller. As a result, the algorithm becomes less sensitive and will not increase the puzzle difficulty too aggressively.

#### Step 2: Calculate the average handled difficulty

Next, the algorithm calculates the average difficulty of the handled requests:

```text
D̄_handled[n] = ΣD_handled[n] / rend_handled[n]
```

This value means: on average, how difficult were the puzzles that clients solved in the last round?

The algorithm uses this average value as the base for the next difficulty. This helps the difficulty change smoothly instead of jumping too suddenly.

#### Step 3: Handle the initial flooding case

There is one special case:

```text
if D̄_handled[n] = 0 and μ_adjust[n] > μ_target:
    D_sug[n+1] = 8
```

This happens when the current puzzle difficulty is still 0, but the service is already processing more requests than the target rate.

In this case, the algorithm immediately sets the next suggested difficulty to 8. This is faster than increasing slowly from 0 to 1, then 2, then 3. The value 8 acts like an early brake, helping the service react quickly when a flooding attack starts.

#### Step 4: Update the next suggested difficulty

In the normal case, the next suggested difficulty is calculated as:

```text
D_sug[n+1] = (μ_adjust[n] / μ_target) × D̄_handled[n]
```

This is the most important part of the new DUA.

The ratio `μ_adjust[n] / μ_target` decides whether the difficulty should go up or down:

* If `μ_adjust[n] > μ_target`, the service is handling more requests than expected, so the next puzzle difficulty increases.
* If `μ_adjust[n] < μ_target`, the service is handling fewer requests than expected, so the next puzzle difficulty decreases.
* If `μ_adjust[n]` is close to `μ_target`, the difficulty stays almost the same.

The algorithm then multiplies this ratio by `D̄_handled[n]`. This means the new difficulty is based on the average difficulty of requests that were actually processed, not just on temporary queue symptoms.

#### Why this update is better

The old DUA reacts to specific queue symptoms, such as congestion flags, remaining requests, or queue trimming. Attackers can exploit these signs by sending requests at carefully chosen times.

The new DUA is harder to trick because it focuses on the actual processing rate of the service. It does not only ask whether the queue looks busy. Instead, it asks how much work the service really handled during the round.

Because of this, short bursts of fake traffic are less likely to make the service increase the puzzle difficulty too much. At the same time, the service can still increase the difficulty when there is real flooding traffic.

 

> Thanks for reading. 


## References 


1. https://spec.torproject.org/intro/index.html
2. https://www.usenix.org/system/files/usenixsecurity25-lee.pdf
