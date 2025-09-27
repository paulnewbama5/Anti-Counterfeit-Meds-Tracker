(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-BATCH-ID u101)
(define-constant ERR-INVALID-PACKAGE-INDEX u102)
(define-constant ERR-INVALID-PRODUCT-ID u103)
(define-constant ERR-SERIAL-ALREADY-EXISTS u104)
(define-constant ERR-INVALID-TIMESTAMP u105)
(define-constant ERR-BATCH-NOT-FOUND u106)
(define-constant ERR-SERIAL-NOT-FOUND u107)
(define-constant ERR-INVALID-HASH-LENGTH u108)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u109)
(define-constant ERR-INVALID-MANUFACTURER u110)
(define-constant ERR-INVALID-EXPIRATION u111)
(define-constant ERR-SERIAL-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-SERIALS-EXCEEDED u114)
(define-constant ERR-INVALID-SERIAL-STATUS u115)
(define-constant ERR-INVALID-QR-DATA u116)
(define-constant ERR-INVALID-LOCATION u117)
(define-constant ERR-INVALID-CURRENCY u118)
(define-constant ERR-INVALID-STATUS u119)
(define-constant ERR-INVALID-METADATA u120)
(define-constant ERR-INVALID-SIGNATURE u121)
(define-constant ERR-INVALID-OWNER u122)
(define-constant ERR-TRANSFER-NOT-ALLOWED u123)
(define-constant ERR-INVALID-RECIPIENT u124)
(define-constant ERR-INVALID-AMOUNT u125)

(define-data-var next-serial-id uint u0)
(define-data-var max-serials-per-batch uint u10000)
(define-data-var serialization-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var batch-manager-contract principal 'SP000000000000000000002Q6VF78)

(define-map serials
  (buff 32)
  {
    batch-id: uint,
    package-index: uint,
    product-id: uint,
    timestamp: uint,
    manufacturer: principal,
    expiration: uint,
    status: bool,
    qr-data: (string-utf8 200),
    location: (string-utf8 100),
    metadata: (string-utf8 500)
  }
)

(define-map serials-by-batch
  uint
  (list 10000 (buff 32))
)

(define-map serial-updates
  (buff 32)
  {
    update-timestamp: uint,
    updater: principal,
    new-status: bool,
    new-metadata: (string-utf8 500)
  }
)

(define-read-only (get-serial (hash (buff 32)))
  (map-get? serials hash)
)

(define-read-only (get-serial-updates (hash (buff 32)))
  (map-get? serial-updates hash)
)

(define-read-only (get-serials-for-batch (batch-id uint))
  (map-get? serials-by-batch batch-id)
)

(define-read-only (is-serial-registered (hash (buff 32)))
  (is-some (map-get? serials hash))
)

(define-private (validate-batch-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-BATCH-ID))
)

(define-private (validate-package-index (index uint))
  (if (> index u0)
      (ok true)
      (err ERR-INVALID-PACKAGE-INDEX))
)

(define-private (validate-product-id (id uint))
  (if (> id u0)
      (ok true)
      (err ERR-INVALID-PRODUCT-ID))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-manufacturer (man principal))
  (if (not (is-eq man 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-INVALID-MANUFACTURER))
)

(define-private (validate-expiration (exp uint))
  (if (> exp block-height)
      (ok true)
      (err ERR-INVALID-EXPIRATION))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-qr-data (data (string-utf8 200)))
  (if (<= (len data) u200)
      (ok true)
      (err ERR-INVALID-QR-DATA))
)

(define-private (validate-metadata (meta (string-utf8 500)))
  (if (<= (len meta) u500)
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH-LENGTH))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-serials-per-batch (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-serials-per-batch new-max)
    (ok true)
  )
)

(define-public (set-serialization-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set serialization-fee new-fee)
    (ok true)
  )
)

(define-public (create-serial
  (batch-id uint)
  (package-index uint)
  (product-id uint)
  (manufacturer principal)
  (expiration uint)
  (qr-data (string-utf8 200))
  (location (string-utf8 100))
  (metadata (string-utf8 500))
)
  (let (
        (serial-hash (sha256 (concat (concat (concat (concat (concat (as-max-len? (unwrap-panic (to-consensus-buff? batch-id)) u128) (unwrap-panic (to-consensus-buff? package-index))) (unwrap-panic (to-consensus-buff? product-id))) (unwrap-panic (to-consensus-buff? manufacturer))) (unwrap-panic (to-consensus-buff? expiration))) (unwrap-panic (to-consensus-buff? block-height)))))
        (current-serials (default-to (list) (map-get? serials-by-batch batch-id)))
        (authority (var-get authority-contract))
      )
    (try! (validate-hash serial-hash))
    (try! (validate-batch-id batch-id))
    (try! (validate-package-index package-index))
    (try! (validate-product-id product-id))
    (try! (validate-manufacturer manufacturer))
    (try! (validate-expiration expiration))
    (try! (validate-qr-data qr-data))
    (try! (validate-location location))
    (try! (validate-metadata metadata))
    (asserts! (< (len current-serials) (var-get max-serials-per-batch)) (err ERR-MAX-SERIALS-EXCEEDED))
    (asserts! (is-none (map-get? serials serial-hash)) (err ERR-SERIAL-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get serialization-fee) tx-sender authority-recipient))
    )
    (map-set serials serial-hash
      {
        batch-id: batch-id,
        package-index: package-index,
        product-id: product-id,
        timestamp: block-height,
        manufacturer: manufacturer,
        expiration: expiration,
        status: true,
        qr-data: qr-data,
        location: location,
        metadata: metadata
      }
    )
    (map-set serials-by-batch batch-id (unwrap-panic (as-max-len? (append current-serials serial-hash) u10000)))
    (var-set next-serial-id (+ (var-get next-serial-id) u1))
    (print { event: "serial-created", hash: serial-hash })
    (ok serial-hash)
  )
)

(define-public (update-serial
  (serial-hash (buff 32))
  (new-status bool)
  (new-metadata (string-utf8 500))
)
  (let ((serial (map-get? serials serial-hash)))
    (match serial
      s
        (begin
          (asserts! (is-eq (get manufacturer s) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-metadata new-metadata))
          (map-set serials serial-hash
            (merge s {
              status: new-status,
              metadata: new-metadata
            })
          )
          (map-set serial-updates serial-hash
            {
              update-timestamp: block-height,
              updater: tx-sender,
              new-status: new-status,
              new-metadata: new-metadata
            }
          )
          (print { event: "serial-updated", hash: serial-hash })
          (ok true)
        )
      (err ERR-SERIAL-NOT-FOUND)
    )
  )
)

(define-public (validate-serial-existence (hash (buff 32)))
  (ok (is-serial-registered hash))
)

(define-public (get-serial-count-for-batch (batch-id uint))
  (ok (len (default-to (list) (map-get? serials-by-batch batch-id))))
)