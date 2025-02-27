import Datastore from "nedb-promises";

class DatabaseService {
  balances = Datastore.create({
    filename: "database/balances.db",
    autoload: true,
  });
  positions = Datastore.create({
    filename: "database/positions.db",
    autoload: true,
  });
  swaps = Datastore.create({ filename: "database/swaps.db", autoload: true });

  constructor() {}

  async addBalance(balance: any) {
    return await this.balances.insert({ ...balance, date: new Date() });
  }

  async getLastBalance() {
    return await this.balances.findOne({}).sort({ _id: -1 });
  }

  async addPosition(position: any) {
    const existsPosition = await this.positions.findOne({
      positionMint: position.positionMint,
    });
    if (existsPosition) return;
    return await this.positions.insert({ ...position, date: new Date() });
  }

  async closePosition(positionMint: any) {
    return await this.positions.updateOne(
      { positionMint },
      { $set: { isOpen: false } }
    );
  }

  async addPositionUpdate(positionMint: any, update: any) {
    await this.positions.updateOne(
      { positionMint },
      { $push: { updates: update } }
    );
  }

  async getOpenPositionByPositionMint(positionMint: string) {
    return (await this.positions.findOne({
      isOpen: true,
      positionMint,
    })) as any;
  }

  async addSwap(swap: any) {
    return await this.swaps.insert({ ...swap, date: new Date() });
  }
}

export const database = new DatabaseService();
