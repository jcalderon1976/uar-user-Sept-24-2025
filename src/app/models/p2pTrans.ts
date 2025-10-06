import { Timestamp } from "@firebase/firestore";

// p2p-trans.model.ts
export interface P2pTrans {
    requestId: number;
    amount: number | null;
    currency: string | null;
    authorization: string | null;
    franchise: string | null;
    internalReference: number | null;
    issuerName: string | null;
    paymentMethod: string | null;
    paymentMethodName: string | null;
    receipt: string | null;
    refunded: boolean;
    status: string | null;
    message: string | null;
  }
  
  export function emptyP2pTrans(overrides: Partial<P2pTrans> = {}): P2pTrans {
    return {
      requestId: 0,
      amount: null,
      currency: null,
      authorization: null,
      franchise: null,
      internalReference: null,
      issuerName: null,
      paymentMethod: null,
      paymentMethodName: null,
      receipt: null,
      refunded: false,
      status: null,
      message: null,
      ...overrides
    };
  }
  