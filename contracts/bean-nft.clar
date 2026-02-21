;; BeanOnStacks NFT  SIP-009 Compliant
;; A limited-edition NFT collection on Stacks testnet
;; 1000 supply, 1 STX mint, max 10 per wallet, single image

(impl-trait 'ST1NXBK3K5YYMD6FD41MVNP3JS1GABZ8TRVX023PT.nft-trait.nft-trait)

;; Define the NFT
(define-non-fungible-token bean-nft uint)

;; Constants
(define-constant CONTRACT-OWNER tx-sender)
(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-SOLD-OUT (err u101))
(define-constant ERR-NOT-TOKEN-OWNER (err u102))
(define-constant ERR-MINT-LIMIT (err u103))
(define-constant MAX-SUPPLY u1000)
(define-constant MINT-PRICE u1000000) ;; 1 STX in micro-STX
(define-constant MAX-PER-WALLET u10)

;; Data variables
(define-data-var last-token-id uint u0)
(define-data-var base-uri (string-ascii 200) "https://beanonstacks.github.io/metadata/bean.json")

;; Track mints per wallet
(define-map mints-per-wallet principal uint)

;; ===== SIP-009 Read-Only Functions =====

(define-read-only (get-last-token-id)
  (ok (var-get last-token-id))
)

(define-read-only (get-token-uri (token-id uint))
  (if (<= token-id (var-get last-token-id))
    (ok (some (var-get base-uri)))
    (ok none)
  )
)

(define-read-only (get-owner (token-id uint))
  (ok (nft-get-owner? bean-nft token-id))
)

;; ===== SIP-009 Transfer Function =====

(define-public (transfer (token-id uint) (sender principal) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender sender) ERR-NOT-AUTHORIZED)
    (nft-transfer? bean-nft token-id sender recipient)
  )
)

;; ===== Mint Function =====

(define-public (mint)
  (let
    (
      (next-id (+ (var-get last-token-id) u1))
      (caller-mints (default-to u0 (map-get? mints-per-wallet tx-sender)))
    )
    ;; Check max supply
    (asserts! (<= next-id MAX-SUPPLY) ERR-SOLD-OUT)
    ;; Check per-wallet limit
    (asserts! (< caller-mints MAX-PER-WALLET) ERR-MINT-LIMIT)
    ;; Charge mint price (1 STX)
    (try! (stx-transfer? MINT-PRICE tx-sender CONTRACT-OWNER))
    ;; Mint the NFT
    (try! (nft-mint? bean-nft next-id tx-sender))
    ;; Update counter
    (var-set last-token-id next-id)
    ;; Update mints per wallet
    (map-set mints-per-wallet tx-sender (+ caller-mints u1))
    (ok next-id)
  )
)

;; ===== Admin Functions =====

(define-public (set-base-uri (new-uri (string-ascii 200)))
  (begin
    (asserts! (is-eq tx-sender CONTRACT-OWNER) ERR-NOT-AUTHORIZED)
    (var-set base-uri new-uri)
    (ok true)
  )
)

;; ===== Read-Only Helpers =====

(define-read-only (get-max-supply)
  (ok MAX-SUPPLY)
)

(define-read-only (get-mint-price)
  (ok MINT-PRICE)
)

(define-read-only (get-mints-of (wallet principal))
  (ok (default-to u0 (map-get? mints-per-wallet wallet)))
)
