import { describe, it, expect, beforeEach } from "vitest";

const ERR_INVALID_BATCH_ID = 101;
const ERR_INVALID_PACKAGE_INDEX = 102;
const ERR_INVALID_PRODUCT_ID = 103;
const ERR_SERIAL_ALREADY_EXISTS = 104;
const ERR_INVALID_MANUFACTURER = 110;
const ERR_INVALID_EXPIRATION = 111;
const ERR_MAX_SERIALS_EXCEEDED = 114;
const ERR_INVALID_QR_DATA = 116;
const ERR_INVALID_LOCATION = 117;
const ERR_INVALID_METADATA = 120;
const ERR_AUTHORITY_NOT_VERIFIED = 109;

interface Serial {
  batchId: number;
  packageIndex: number;
  productId: number;
  timestamp: number;
  manufacturer: string;
  expiration: number;
  status: boolean;
  qrData: string;
  location: string;
  metadata: string;
}

interface SerialUpdate {
  updateTimestamp: number;
  updater: string;
  newStatus: boolean;
  newMetadata: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class SerializationEngineMock {
  state: {
    nextSerialId: number;
    maxSerialsPerBatch: number;
    serializationFee: number;
    authorityContract: string | null;
    serials: Map<string, Serial>;
    serialsByBatch: Map<number, string[]>;
    serialUpdates: Map<string, SerialUpdate>;
  } = {
    nextSerialId: 0,
    maxSerialsPerBatch: 10000,
    serializationFee: 500,
    authorityContract: null,
    serials: new Map(),
    serialsByBatch: new Map(),
    serialUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextSerialId: 0,
      maxSerialsPerBatch: 10000,
      serializationFee: 500,
      authorityContract: null,
      serials: new Map(),
      serialsByBatch: new Map(),
      serialUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.stxTransfers = [];
  }

  private sha256(input: string): string {
    return "a".repeat(32);
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxSerialsPerBatch(newMax: number): Result<boolean> {
    if (newMax <= 0) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.maxSerialsPerBatch = newMax;
    return { ok: true, value: true };
  }

  setSerializationFee(newFee: number): Result<boolean> {
    if (newFee < 0) return { ok: false, value: false };
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.serializationFee = newFee;
    return { ok: true, value: true };
  }

  createSerial(
    batchId: number,
    packageIndex: number,
    productId: number,
    manufacturer: string,
    expiration: number,
    qrData: string,
    location: string,
    metadata: string
  ): Result<string> {
    const serialHash = this.sha256(`${batchId}_${packageIndex}_${productId}_${manufacturer}_${expiration}_${this.blockHeight}`);
    if (serialHash.length !== 32) return { ok: false, value: "ERR_INVALID_HASH_LENGTH" };
    if (batchId <= 0) return { ok: false, value: "ERR_INVALID_BATCH_ID" };
    if (packageIndex <= 0) return { ok: false, value: "ERR_INVALID_PACKAGE_INDEX" };
    if (productId <= 0) return { ok: false, value: "ERR_INVALID_PRODUCT_ID" };
    if (manufacturer === "SP000000000000000000002Q6VF78") return { ok: false, value: "ERR_INVALID_MANUFACTURER" };
    if (expiration <= this.blockHeight) return { ok: false, value: "ERR_INVALID_EXPIRATION" };
    if (qrData.length > 200) return { ok: false, value: "ERR_INVALID_QR_DATA" };
    if (!location || location.length > 100) return { ok: false, value: "ERR_INVALID_LOCATION" };
    if (metadata.length > 500) return { ok: false, value: "ERR_INVALID_METADATA" };
    const currentSerials = this.state.serialsByBatch.get(batchId) || [];
    if (currentSerials.length >= this.state.maxSerialsPerBatch) return { ok: false, value: "ERR_MAX_SERIALS_EXCEEDED" };
    if (this.state.serials.has(serialHash)) return { ok: false, value: "ERR_SERIAL_ALREADY_EXISTS" };
    if (!this.state.authorityContract) return { ok: false, value: "ERR_AUTHORITY_NOT_VERIFIED" };

    this.stxTransfers.push({ amount: this.state.serializationFee, from: this.caller, to: this.state.authorityContract });

    const serial: Serial = {
      batchId,
      packageIndex,
      productId,
      timestamp: this.blockHeight,
      manufacturer,
      expiration,
      status: true,
      qrData,
      location,
      metadata,
    };
    this.state.serials.set(serialHash, serial);
    this.state.serialsByBatch.set(batchId, [...currentSerials, serialHash]);
    this.state.nextSerialId++;
    return { ok: true, value: serialHash };
  }

  getSerial(hash: string): Serial | null {
    return this.state.serials.get(hash) || null;
  }

  updateSerial(hash: string, newStatus: boolean, newMetadata: string): Result<boolean> {
    const serial = this.state.serials.get(hash);
    if (!serial) return { ok: false, value: false };
    if (serial.manufacturer !== this.caller) return { ok: false, value: false };
    if (newMetadata.length > 500) return { ok: false, value: false };

    const updated: Serial = {
      ...serial,
      status: newStatus,
      metadata: newMetadata,
    };
    this.state.serials.set(hash, updated);
    this.state.serialUpdates.set(hash, {
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      newStatus,
      newMetadata,
    });
    return { ok: true, value: true };
  }

  validateSerialExistence(hash: string): Result<boolean> {
    return { ok: true, value: this.state.serials.has(hash) };
  }

  getSerialCountForBatch(batchId: number): Result<number> {
    const serials = this.state.serialsByBatch.get(batchId) || [];
    return { ok: true, value: serials.length };
  }
}

describe("SerializationEngine", () => {
  let contract: SerializationEngineMock;

  beforeEach(() => {
    contract = new SerializationEngineMock();
    contract.reset();
  });

  it("creates a serial successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(true);
    expect(typeof result.value).toBe("string");

    const serial = contract.getSerial(result.value);
    expect(serial?.batchId).toBe(1);
    expect(serial?.packageIndex).toBe(1);
    expect(serial?.productId).toBe(100);
    expect(serial?.manufacturer).toBe("ST1TEST");
    expect(serial?.expiration).toBe(1000);
    expect(serial?.status).toBe(true);
    expect(serial?.qrData).toBe("qrdata");
    expect(serial?.location).toBe("LocationX");
    expect(serial?.metadata).toBe("metadata");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate serial hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    const result = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_SERIAL_ALREADY_EXISTS");
  });

  it("rejects serial creation without authority contract", () => {
    const result = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_AUTHORITY_NOT_VERIFIED");
  });

  it("rejects invalid batch id", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createSerial(
      0,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_BATCH_ID");
  });

  it("rejects invalid package index", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createSerial(
      1,
      0,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_PACKAGE_INDEX");
  });

  it("rejects invalid product id", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createSerial(
      1,
      1,
      0,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_PRODUCT_ID");
  });

  it("rejects invalid manufacturer", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createSerial(
      1,
      1,
      100,
      "SP000000000000000000002Q6VF78",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_MANUFACTURER");
  });

  it("rejects invalid expiration", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      0,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_EXPIRATION");
  });

  it("rejects invalid qr data", () => {
    contract.setAuthorityContract("ST2TEST");
    const longQr = "a".repeat(201);
    const result = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      longQr,
      "LocationX",
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_QR_DATA");
  });

  it("rejects invalid location", () => {
    contract.setAuthorityContract("ST2TEST");
    const longLoc = "a".repeat(101);
    const result = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      longLoc,
      "metadata"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_LOCATION");
  });

  it("rejects invalid metadata", () => {
    contract.setAuthorityContract("ST2TEST");
    const longMeta = "a".repeat(501);
    const result = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      longMeta
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_INVALID_METADATA");
  });

  it("rejects max serials exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMaxSerialsPerBatch(1);
    contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    const result = contract.createSerial(
      1,
      2,
      100,
      "ST1TEST",
      1000,
      "qrdata2",
      "LocationY",
      "metadata2"
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe("ERR_MAX_SERIALS_EXCEEDED");
  });

  it("updates a serial successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const createResult = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    const hash = createResult.value as string;
    const result = contract.updateSerial(hash, false, "new metadata");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const serial = contract.getSerial(hash);
    expect(serial?.status).toBe(false);
    expect(serial?.metadata).toBe("new metadata");
    const update = contract.state.serialUpdates.get(hash);
    expect(update?.newStatus).toBe(false);
    expect(update?.newMetadata).toBe("new metadata");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent serial", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateSerial("nonexistent", false, "new metadata");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-manufacturer", () => {
    contract.setAuthorityContract("ST2TEST");
    const createResult = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    const hash = createResult.value as string;
    contract.caller = "ST3FAKE";
    const result = contract.updateSerial(hash, false, "new metadata");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects invalid update metadata", () => {
    contract.setAuthorityContract("ST2TEST");
    const createResult = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    const hash = createResult.value as string;
    const longMeta = "a".repeat(501);
    const result = contract.updateSerial(hash, false, longMeta);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets serialization fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setSerializationFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.serializationFee).toBe(1000);
    contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    expect(contract.stxTransfers[0].amount).toEqual(1000);
  });

  it("rejects serialization fee change without authority", () => {
    const result = contract.setSerializationFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("checks serial existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const createResult = contract.createSerial(
      1,
      1,
      100,
      "ST1TEST",
      1000,
      "qrdata",
      "LocationX",
      "metadata"
    );
    const hash = createResult.value as string;
    const result = contract.validateSerialExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.validateSerialExistence("nonexistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});