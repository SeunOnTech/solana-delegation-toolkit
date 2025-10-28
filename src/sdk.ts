// src/sdk.ts

import { 
    Connection, 
    PublicKey, 
    Transaction, 
    SystemProgram,
    TransactionInstruction,
    LAMPORTS_PER_SOL
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import idl from './idl/smart_account.json';

// Define the structure of a smart account based on your IDL
export type SmartAccountState = {
    owner: PublicKey;
    delegates: PublicKey[];
    paused: boolean;
};

export class SmartAccountSDK {
    public program: anchor.Program;
    public provider: anchor.AnchorProvider;
    public connection: Connection;
    public userPublicKey: PublicKey;

    /**
     * Creates a new SmartAccountSDK instance for composing transactions.
     * @param connection The Solana Connection object.
     * @param userPublicKey The public key of the user who will be signing the transactions.
     */
    constructor(connection: Connection, userPublicKey: PublicKey) {
        this.connection = connection;
        this.userPublicKey = userPublicKey;

        // A "dummy" wallet is used to create a read-only provider.
        const dummyWallet = {
            publicKey: userPublicKey,
            signTransaction: () => Promise.reject(new Error("SDK is in read-only mode and cannot sign transactions.")),
            signAllTransactions: () => Promise.reject(new Error("SDK is in read-only mode and cannot sign transactions.")),
        };
        
        this.provider = new anchor.AnchorProvider(connection, dummyWallet as unknown as anchor.Wallet, {
            preflightCommitment: "confirmed",
        });
        anchor.setProvider(this.provider);

        this.program = new anchor.Program(idl as any, this.provider);
    }

    /**
     * Finds the PDA for a smart account given an owner.
     * @param owner The public key of the owner.
     * @returns The smart account PDA and bump seed.
     */
    findSmartAccountPDA(owner: PublicKey): [PublicKey, number] {
        return PublicKey.findProgramAddressSync(
            [Buffer.from("smart"), owner.toBuffer()],
            this.program.programId
        );
    }

    /**
     * Fetches the state of a given smart account.
     * @param smartAccountAddress The public key of the smart account.
     * @returns A promise that resolves to the smart account's state.
     */
    async getSmartAccountState(smartAccountAddress: PublicKey): Promise<SmartAccountState> {
        return (this.program.account as any).smartAccount.fetch(smartAccountAddress) as Promise<SmartAccountState>;
    }

    /**
     * Composes an unsigned transaction to initialize a smart account.
     * @param owner The public key of the owner (defaults to userPublicKey).
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async initialize(owner?: PublicKey): Promise<Transaction> {
        const ownerKey = owner || this.userPublicKey;
        const [smartAccountPDA] = this.findSmartAccountPDA(ownerKey);

        return this.program.methods
            .initialize()
            .accounts({
                smartAccount: smartAccountPDA,
                owner: ownerKey,
                systemProgram: SystemProgram.programId,
            })
            .transaction();
    }

    /**
     * Composes an unsigned transaction to add a delegate.
     * @param delegate The public key of the delegate to add.
     * @param owner The public key of the owner (defaults to userPublicKey).
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async addDelegate(delegate: PublicKey, owner?: PublicKey): Promise<Transaction> {
        const ownerKey = owner || this.userPublicKey;
        const [smartAccountPDA] = this.findSmartAccountPDA(ownerKey);

        return this.program.methods
            .addDelegate(delegate)
            .accounts({
                smartAccount: smartAccountPDA,
                owner: ownerKey,
            })
            .transaction();
    }

    /**
     * Composes an unsigned transaction to remove a delegate.
     * @param delegate The public key of the delegate to remove.
     * @param owner The public key of the owner (defaults to userPublicKey).
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async removeDelegate(delegate: PublicKey, owner?: PublicKey): Promise<Transaction> {
        const ownerKey = owner || this.userPublicKey;
        const [smartAccountPDA] = this.findSmartAccountPDA(ownerKey);

        return this.program.methods
            .removeDelegate(delegate)
            .accounts({
                smartAccount: smartAccountPDA,
                owner: ownerKey,
            })
            .transaction();
    }

    /**
     * Composes an unsigned transaction to pause the smart account.
     * @param owner The public key of the owner (defaults to userPublicKey).
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async pause(owner?: PublicKey): Promise<Transaction> {
        const ownerKey = owner || this.userPublicKey;
        const [smartAccountPDA] = this.findSmartAccountPDA(ownerKey);

        return this.program.methods
            .pause()
            .accounts({
                smartAccount: smartAccountPDA,
                owner: ownerKey,
            })
            .transaction();
    }

    /**
     * Composes an unsigned transaction to unpause the smart account.
     * @param owner The public key of the owner (defaults to userPublicKey).
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async unpause(owner?: PublicKey): Promise<Transaction> {
        const ownerKey = owner || this.userPublicKey;
        const [smartAccountPDA] = this.findSmartAccountPDA(ownerKey);

        return this.program.methods
            .unpause()
            .accounts({
                smartAccount: smartAccountPDA,
                owner: ownerKey,
            })
            .transaction();
    }

    /**
     * Composes an unsigned transaction to execute a SOL transfer via the smart account.
     * @param smartAccountOwner The owner of the smart account.
     * @param delegate The delegate executing the transfer.
     * @param recipient The recipient of the SOL.
     * @param lamports The amount of lamports to transfer.
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async executeSolTransfer(
        smartAccountOwner: PublicKey,
        delegate: PublicKey,
        recipient: PublicKey,
        lamports: number | anchor.BN
    ): Promise<Transaction> {
        const [smartAccountPDA] = this.findSmartAccountPDA(smartAccountOwner);
        
        // Build instruction data for system transfer
        // Format: [instruction_index (4 bytes), lamports (8 bytes)]
        const instructionIndex = 2; // System Program transfer instruction
        const lamportsAmount = typeof lamports === 'number' ? new anchor.BN(lamports) : lamports;
        
        const instructionData = Buffer.alloc(12);
        instructionData.writeUInt32LE(instructionIndex, 0);
        instructionData.writeBigUInt64LE(BigInt(lamportsAmount.toString()), 4);

        return this.program.methods
            .execute(instructionData)
            .accounts({
                smartAccount: smartAccountPDA,
                delegate: delegate,
            })
            .remainingAccounts([
                { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
                { pubkey: smartAccountPDA, isSigner: false, isWritable: true },
                { pubkey: recipient, isSigner: false, isWritable: true },
            ])
            .transaction();
    }

    /**
     * Composes an unsigned transaction to execute a token transfer via the smart account.
     * @param smartAccountOwner The owner of the smart account.
     * @param delegate The delegate executing the transfer.
     * @param fromTokenAccount The source token account.
     * @param toTokenAccount The destination token account.
     * @param amount The amount of tokens to transfer.
     * @param useToken2022 Whether to use Token-2022 program (default: false for standard Token Program).
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async executeTokenTransfer(
        smartAccountOwner: PublicKey,
        delegate: PublicKey,
        fromTokenAccount: PublicKey,
        toTokenAccount: PublicKey,
        amount: number | anchor.BN,
        useToken2022: boolean = false
    ): Promise<Transaction> {
        const [smartAccountPDA] = this.findSmartAccountPDA(smartAccountOwner);
        
        // Build instruction data for token transfer
        // SPL Token Transfer instruction: [3 (u8), amount (u64)]
        const transferAmount = typeof amount === 'number' ? new anchor.BN(amount) : amount;
        
        const instructionData = Buffer.alloc(9);
        instructionData.writeUInt8(3, 0); // Transfer instruction
        instructionData.writeBigUInt64LE(BigInt(transferAmount.toString()), 1);

        const tokenProgramId = useToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

        return this.program.methods
            .execute(instructionData)
            .accounts({
                smartAccount: smartAccountPDA,
                delegate: delegate,
            })
            .remainingAccounts([
                { pubkey: tokenProgramId, isSigner: false, isWritable: false },
                { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
                { pubkey: toTokenAccount, isSigner: false, isWritable: true },
                { pubkey: smartAccountPDA, isSigner: false, isWritable: false },
            ])
            .transaction();
    }

    /**
     * Composes an unsigned transaction to execute an arbitrary instruction via the smart account.
     * This is a lower-level method for advanced use cases.
     * @param smartAccountOwner The owner of the smart account.
     * @param delegate The delegate executing the instruction.
     * @param targetProgram The program to call.
     * @param instructionData The instruction data.
     * @param remainingAccounts The accounts required by the target instruction (excluding the target program).
     * @returns A promise that resolves to the unsigned Transaction object.
     */
    async executeCustomInstruction(
        smartAccountOwner: PublicKey,
        delegate: PublicKey,
        targetProgram: PublicKey,
        instructionData: Buffer,
        remainingAccounts: Array<{ pubkey: PublicKey; isSigner: boolean; isWritable: boolean }>
    ): Promise<Transaction> {
        const [smartAccountPDA] = this.findSmartAccountPDA(smartAccountOwner);

        return this.program.methods
            .execute(instructionData)
            .accounts({
                smartAccount: smartAccountPDA,
                delegate: delegate,
            })
            .remainingAccounts([
                { pubkey: targetProgram, isSigner: false, isWritable: false },
                ...remainingAccounts,
            ])
            .transaction();
    }

    /**
     * Helper method to convert SOL to lamports.
     * @param sol Amount in SOL.
     * @returns Amount in lamports.
     */
    static solToLamports(sol: number): number {
        return sol * LAMPORTS_PER_SOL;
    }

    /**
     * Helper method to convert lamports to SOL.
     * @param lamports Amount in lamports.
     * @returns Amount in SOL.
     */
    static lamportsToSol(lamports: number): number {
        return lamports / LAMPORTS_PER_SOL;
    }
}