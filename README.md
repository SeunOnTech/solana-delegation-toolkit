# Solana Delegation Toolkit

A TypeScript SDK for interacting with the Smart Account program on Solana. This SDK enables delegation-based transaction execution, allowing trusted delegates to execute transactions on behalf of the account owner through a secure vault system.

## Features

- **Account Initialization**: Create smart accounts with owner controls
- **Delegate Management**: Add and remove trusted delegates
- **Emergency Controls**: Pause/unpause functionality for security
- **SOL Transfers**: Execute native SOL transfers through the smart account
- **Token Transfers**: Support for both SPL Token and Token-2022 programs
- **Custom Instructions**: Execute arbitrary program instructions via the vault
- **Type Safety**: Full TypeScript support with type definitions
- **Transaction Composition**: Returns unsigned transactions for flexible signing workflows

## Installation

```bash
npm install @seunontech/solana-delegation-toolkit
```

### Peer Dependencies

```bash
npm install @solana/web3.js @coral-xyz/anchor @solana/spl-token
```

## Quick Start

```typescript
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { SmartAccountSDK } from '@seunontech/solana-delegation-toolkit';

(async () => {
  try {
    // Initialize the connection and SDK
    const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
    const userKeypair = Keypair.generate();

    const sdk = new SmartAccountSDK(connection, userKeypair.publicKey);

    // Create a smart account
    const initTx = await sdk.initialize();
    const { blockhash } = await connection.getLatestBlockhash();

    initTx.feePayer = userKeypair.publicKey;
    initTx.recentBlockhash = blockhash;
    initTx.sign(userKeypair);

    const signature = await connection.sendRawTransaction(initTx.serialize());
    console.log('✅ Smart account created!');
    console.log('Transaction Signature:', signature);
  } catch (error) {
    console.error('❌ Error initializing smart account:', error);
  }
})();
```

## Usage

### 1. Initialize Smart Account

Create a new smart account vault for an owner:

```typescript
const ownerPublicKey = userKeypair.publicKey;
const initTx = await sdk.initialize(ownerPublicKey);

// Sign and send the transaction
initTx.feePayer = ownerPublicKey;
initTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
initTx.sign(userKeypair);
const signature = await connection.sendRawTransaction(initTx.serialize());
await connection.confirmTransaction(signature);
```

### 2. Manage Delegates

Add or remove trusted delegates who can execute transactions:

```typescript
// Add a delegate
const delegatePublicKey = new PublicKey('DELEGATE_ADDRESS');
const addTx = await sdk.addDelegate(delegatePublicKey);

// Sign and send
addTx.feePayer = ownerPublicKey;
addTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
addTx.sign(ownerKeypair);
await connection.sendRawTransaction(addTx.serialize());

// Remove a delegate
const removeTx = await sdk.removeDelegate(delegatePublicKey);
// Sign and send similarly...
```

### 3. Emergency Pause Controls

Pause and unpause the smart account in emergency situations:

```typescript
// Pause the account
const pauseTx = await sdk.pause();
pauseTx.feePayer = ownerPublicKey;
pauseTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
pauseTx.sign(ownerKeypair);
await connection.sendRawTransaction(pauseTx.serialize());

// Unpause the account
const unpauseTx = await sdk.unpause();
// Sign and send similarly...
```

### 4. Execute SOL Transfers

Transfer SOL from the smart account vault:

```typescript
const recipientPublicKey = new PublicKey('RECIPIENT_ADDRESS');
const lamports = SmartAccountSDK.solToLamports(0.1); // 0.1 SOL

const transferTx = await sdk.executeSolTransfer(
    ownerPublicKey,      // Smart account owner
    delegatePublicKey,   // Delegate executing the transfer
    recipientPublicKey,  // Recipient
    lamports            // Amount in lamports
);

// Sign with delegate keypair
transferTx.feePayer = delegatePublicKey;
transferTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
transferTx.sign(delegateKeypair);
await connection.sendRawTransaction(transferTx.serialize());
```

### 5. Execute Token Transfers

Transfer SPL tokens or Token-2022 tokens:

```typescript
import { getAssociatedTokenAddressSync } from '@solana/spl-token';

const tokenMint = new PublicKey('TOKEN_MINT_ADDRESS');
const [smartAccountPDA] = sdk.findSmartAccountPDA(ownerPublicKey);

// Get token accounts
const fromTokenAccount = getAssociatedTokenAddressSync(
    tokenMint, 
    smartAccountPDA, 
    true
);
const toTokenAccount = getAssociatedTokenAddressSync(
    tokenMint, 
    recipientPublicKey
);

// Execute token transfer
const tokenTransferTx = await sdk.executeTokenTransfer(
    ownerPublicKey,      // Smart account owner
    delegatePublicKey,   // Delegate executing the transfer
    fromTokenAccount,    // Source token account
    toTokenAccount,      // Destination token account
    1000000,            // Amount (in token's smallest unit)
    false               // Use Token-2022? (false for standard SPL Token)
);

// Sign and send with delegate
tokenTransferTx.feePayer = delegatePublicKey;
tokenTransferTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
tokenTransferTx.sign(delegateKeypair);
await connection.sendRawTransaction(tokenTransferTx.serialize());
```

### 6. Execute Custom Instructions

For advanced use cases, execute arbitrary program instructions:

```typescript
const targetProgram = new PublicKey('PROGRAM_ID');
const instructionData = Buffer.from([...]); // Your instruction data

const customTx = await sdk.executeCustomInstruction(
    ownerPublicKey,
    delegatePublicKey,
    targetProgram,
    instructionData,
    [
        { pubkey: account1, isSigner: false, isWritable: true },
        { pubkey: account2, isSigner: false, isWritable: false },
        // ... more accounts as needed
    ]
);

// Sign and send
customTx.feePayer = delegatePublicKey;
customTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
customTx.sign(delegateKeypair);
await connection.sendRawTransaction(customTx.serialize());
```

### 7. Query Smart Account State

Fetch the current state of a smart account:

```typescript
const [smartAccountPDA] = sdk.findSmartAccountPDA(ownerPublicKey);
const accountState = await sdk.getSmartAccountState(smartAccountPDA);

console.log('Owner:', accountState.owner.toString());
console.log('Delegates:', accountState.delegates.map(d => d.toString()));
console.log('Paused:', accountState.paused);
```

## API Reference

### Constructor

```typescript
new SmartAccountSDK(connection: Connection, userPublicKey: PublicKey)
```

Creates a new SDK instance for composing transactions.

### Methods

#### Account Management

- **`initialize(owner?: PublicKey): Promise<Transaction>`**  
  Initialize a new smart account. Defaults to `userPublicKey` if owner is not provided.

- **`addDelegate(delegate: PublicKey, owner?: PublicKey): Promise<Transaction>`**  
  Add a trusted delegate to the smart account.

- **`removeDelegate(delegate: PublicKey, owner?: PublicKey): Promise<Transaction>`**  
  Remove a delegate from the smart account.

- **`pause(owner?: PublicKey): Promise<Transaction>`**  
  Pause the smart account (emergency stop).

- **`unpause(owner?: PublicKey): Promise<Transaction>`**  
  Unpause the smart account (resume operations).

#### Transaction Execution

- **`executeSolTransfer(smartAccountOwner: PublicKey, delegate: PublicKey, recipient: PublicKey, lamports: number | BN): Promise<Transaction>`**  
  Execute a SOL transfer from the smart account vault.

- **`executeTokenTransfer(smartAccountOwner: PublicKey, delegate: PublicKey, fromTokenAccount: PublicKey, toTokenAccount: PublicKey, amount: number | BN, useToken2022?: boolean): Promise<Transaction>`**  
  Execute a token transfer. Set `useToken2022` to `true` for Token-2022 tokens.

- **`executeCustomInstruction(smartAccountOwner: PublicKey, delegate: PublicKey, targetProgram: PublicKey, instructionData: Buffer, remainingAccounts: AccountMeta[]): Promise<Transaction>`**  
  Execute a custom program instruction via the smart account.

#### Helper Methods

- **`findSmartAccountPDA(owner: PublicKey): [PublicKey, number]`**  
  Find the Program Derived Address (PDA) for a smart account.

- **`getSmartAccountState(smartAccountAddress: PublicKey): Promise<SmartAccountState>`**  
  Fetch the state of a smart account.

- **`static solToLamports(sol: number): number`**  
  Convert SOL to lamports.

- **`static lamportsToSol(lamports: number): number`**  
  Convert lamports to SOL.

## Types

```typescript
type SmartAccountState = {
    owner: PublicKey;
    delegates: PublicKey[];
    paused: boolean;
};
```

## Security Considerations

1. **Owner Controls**: Only the owner can add/remove delegates and pause/unpause the account
2. **Delegate Authorization**: Only approved delegates can execute transactions
3. **Pause Mechanism**: Emergency pause prevents all delegated operations
4. **Rent Exemption**: SOL transfers automatically maintain minimum rent-exempt balance
5. **PDA Authority**: The smart account PDA signs all outgoing transactions

## Program Details

- **Program ID**: `73y8v8vVpDDStuVVTwuhUkcuaRpCpnUD5tg7hKcWYa5o`
- **Max Delegates**: 10 per smart account
- **Supported Networks**: Devnet, Testnet, Mainnet-Beta

## Error Codes

| Code | Name | Description |
|------|------|-------------|
| 6000 | Unauthorized | Unauthorized operation |
| 6001 | Paused | Smart account is paused |
| 6002 | InvalidInstruction | Invalid instruction data |
| 6003 | InsufficientFunds | Insufficient funds for operation |

## Example: Complete Workflow

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { SmartAccountSDK } from '@seunontech/solana-delegation-toolkit';

async function completeWorkflow() {
    // Setup
    const connection = new Connection('https://api.devnet.solana.com');
    const owner = Keypair.generate();
    const delegate = Keypair.generate();
    const recipient = Keypair.generate();
    
    const sdk = new SmartAccountSDK(connection, owner.publicKey);
    
    // 1. Airdrop SOL for testing
    await connection.requestAirdrop(owner.publicKey, 2e9);
    
    // 2. Initialize smart account
    const initTx = await sdk.initialize();
    await signAndSend(initTx, owner, connection);
    
    // 3. Fund the smart account
    const [smartAccountPDA] = sdk.findSmartAccountPDA(owner.publicKey);
    // ... transfer SOL to smartAccountPDA ...
    
    // 4. Add delegate
    const addDelegateTx = await sdk.addDelegate(delegate.publicKey);
    await signAndSend(addDelegateTx, owner, connection);
    
    // 5. Delegate executes transfer
    const transferTx = await sdk.executeSolTransfer(
        owner.publicKey,
        delegate.publicKey,
        recipient.publicKey,
        SmartAccountSDK.solToLamports(0.5)
    );
    await signAndSend(transferTx, delegate, connection);
    
    console.log('Workflow completed successfully!');
}

async function signAndSend(tx: Transaction, signer: Keypair, connection: Connection) {
    tx.feePayer = signer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(signer);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature);
    return signature;
}
```

## Use Cases

- **Multi-signature wallets**: Delegate transaction execution to multiple parties
- **Trading bots**: Allow bots to execute trades without exposing private keys
- **DeFi protocols**: Enable smart contract interactions via delegates
- **Payment processors**: Automate recurring payments securely
- **DAO treasuries**: Manage treasury operations with role-based access

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

- **NPM Package**: [@seunontech/solana-delegation-toolkit](https://www.npmjs.com/package/@seunontech/solana-delegation-toolkit)
- **GitHub Issues**: Report bugs and request features
- **Twitter**: [@seunontech](https://twitter.com/seunontech)

---

Built with ❤️ by Seunon Tech