# Stellar NFC Payments — Product Flows & System Definition

## Overview

This project enables fast peer-to-peer payments using NFC technology on top of the Stellar network.

The main goal is to create a payment experience similar to contactless card payments, but powered by self-custodial wallets, passkeys, and blockchain settlement.

Users can send and receive funds instantly by simply:

1. Opening the app
2. Entering an amount to receive
3. Bringing two phones close together
4. Confirming with a passkey
5. Completing the Stellar transaction

---

# Core Vision

The application should feel:

- Instant
- Secure
- Minimal
- Familiar
- Mobile-first
- Non-technical for end users

The blockchain complexity must remain invisible to the user.

---

# Main Use Case

## Peer-to-Peer NFC Payment

### Receiver Flow

1. User opens the application
2. User selects:
   - “Receive Payment”

3. User enters the amount to receive
4. App enters NFC listening mode
5. Receiver waits for payer device
6. Devices are brought together
7. Receiver shares payment request securely through NFC

### Sender Flow

3. App activates NFC communication mode
4. Devices are brought together
5. Sender receives payment request
6. Sender reviews:
   - Amount
   - Recipient
   - Asset

7. Sender confirms transaction
8. Sender authenticates using passkey
9. Transaction is signed and submitted to Stellar
10. Both users receive confirmation

---

# User Experience Principles

## Simplicity

The app should minimize:

- Screens
- Inputs
- Blockchain terminology
- Manual wallet interactions

## Fast Interactions

Target:

- Payment completion under 5 seconds

## Secure Authentication

Transactions should require:

- Passkey authentication
- Device authentication
- Secure signing

## Contactless Experience

The interaction should feel similar to:

- Apple Pay
- Google Pay
- Tap-to-pay systems

---

# Authentication Model

## Passkeys

The application uses passkeys for:

- Login
- Transaction approval
- Wallet authorization

## Security Goals

- No passwords
- No seed phrase exposure
- Biometric authentication
- Secure local signing

---

# Wallet Architecture

## Wallet Type

- Self-custodial Stellar wallet

## Wallet Responsibilities

The wallet should:

- Hold Stellar assets
- Sign transactions
- Manage balances
- Support NFC transaction flows

## Asset Support

Initial version:

- XLM
- Stellar USDC

Future versions:

- Additional Stellar assets
- Tokenized assets
- Stablecoins

---

# NFC Communication Flow

## Step-by-Step Interaction

### 1. Receiver Generates Payment Request

Receiver device creates:

- Amount
- Asset
- Receiver address
- Request metadata
- Expiration timestamp

### 2. NFC Handshake

Devices establish NFC communication.

### 3. Payment Request Transfer

Receiver sends payment payload through NFC.

### 4. Validation

Sender validates:

- Request integrity
- Expiration
- Asset support
- Recipient address

### 5. User Confirmation

Sender confirms payment.

### 6. Passkey Authentication

Sender approves using biometric/passkey authentication.

### 7. Transaction Submission

Transaction is:

- Signed
- Submitted to Stellar
- Monitored for confirmation

### 8. Success Response

Both devices display:

- Success state
- Transaction details
- Confirmation feedback

---

# Proposed Payment Payload Structure

The canonical wire contract for NFC payment requests is defined in [docs/payment-request.v1.md](./payment-request.v1.md). Payloads conform to the versioned `payment-request.v1` schema with ISO 8601 UTC timestamps:

```json
{
  "type": "payment-request",
  "version": 1,
  "recipient": "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  "asset": "USDC",
  "amount": "25.00",
  "timestamp": "2026-05-29T12:00:00.000Z",
  "expiresAt": "2026-05-29T12:15:00.000Z"
}
```

For validation rules, required/optional fields, and error codes, refer to [docs/payment-request.v1.md](./payment-request.v1.md) as the single source of truth.

---

# Transaction Lifecycle

## States

### Payment Request Created

Receiver generates NFC payment request.

### Payment Request Shared

NFC payload transferred successfully.

### Payment Authorized

Sender approves transaction.

### Transaction Submitted

Transaction broadcasted to Stellar.

### Transaction Confirmed

Transaction finalized successfully.

### Transaction Failed

Transaction rejected or failed.

---

# Error Handling

## Possible Errors

### NFC Errors

- NFC unavailable
- NFC disabled
- Connection interrupted
- Unsupported device

### Wallet Errors

- Insufficient balance
- Invalid recipient
- Unsupported asset
- Authentication failure

### Network Errors

- Stellar RPC unavailable
- Timeout
- Failed submission

---

# Security Considerations

## NFC Security

The NFC payload should:

- Have short expiration times
- Avoid storing sensitive secrets
- Include request validation
- Prevent replay attacks

## Wallet Security

- Private keys never exposed
- Signing isolated securely
- Passkey required for payments
- Session expiration support

## Transaction Safety

- Explicit confirmation screen
- Transaction simulation before submission
- Clear recipient display

---

# MVP Scope

## Included in MVP

- NFC peer-to-peer payments
- Stellar transaction settlement
- Passkey authentication
- Self-custodial wallet
- XLM support
- USDC support
- Basic transaction history

## Excluded from MVP

- Merchant integrations
- QR payments
- Recurring payments
- Cross-chain support
- Multi-signature accounts
- Offline settlement

---

# Future Features

## Merchant Mode

Dedicated payment receiving mode for businesses.

## Tap-to-Pay Requests

Automatic payment amount suggestions.

## QR + NFC Hybrid Payments

Fallback when NFC is unavailable.

## Social Payments

Send money to usernames or contacts.

## Multi-Asset Support

Support additional Stellar ecosystem assets.

## Cross-Border Payments

International low-fee transfers.

---

# Technical Architecture

## Frontend

Potential technologies:

- React Native
- Expo
- Native mobile integrations

## Blockchain Layer

- Stellar Network
- Horizon / RPC APIs
- Soroban integrations (future)

## Authentication

- WebAuthn
- Platform passkeys
- Biometric authentication

## NFC Layer

Platform integrations:

- Android NFC APIs
- iOS Core NFC

---

# Recommended User Flow Summary

## Receive Payment

```text
Open App
→ Receive Payment
→ Enter Amount
→ Activate NFC
→ Tap Phones
→ Wait for Payment
→ Payment Confirmed
```

## Send Payment

```text
Open App
→ Send Payment
→ Tap Phones
→ Review Request
→ Confirm
→ Passkey Authentication
→ Transaction Submitted
→ Payment Confirmed
```

---

# Design Goals

## Product Goals

- Make crypto payments feel mainstream
- Reduce friction in peer-to-peer payments
- Remove complexity from blockchain interactions
- Enable fast local transactions

## Technical Goals

- Secure transaction signing
- Reliable NFC communication
- Fast transaction finality
- Minimal latency

---

# Open Questions

## Product Questions

- Should users create usernames?
- Should NFC activate automatically?
- Should transaction receipts be shareable?
- Should merchants have a different UI?

## Technical Questions

- How should failed NFC sessions recover?
- Should the payment request be signed?
- What is the maximum NFC payload size?
- Should transactions be pre-simulated?

---

# Success Metrics

## User Metrics

- Payment completion rate
- Average payment time
- Daily active users
- Transaction volume

## Technical Metrics

- NFC connection success rate
- Transaction success rate
- Authentication success rate
- Average confirmation latency

---

# Conclusion

This project aims to create a seamless NFC-based payment experience on Stellar that combines:

- Contactless interactions
- Self-custodial ownership
- Passkey security
- Instant blockchain payments

The long-term vision is to make blockchain payments feel as simple and natural as tapping a card or phone at a terminal.
