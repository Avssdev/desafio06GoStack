import { EntityRepository, Repository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactions = await this.find();

    const { income, outcome } = transactions.reduce<Balance>(
      (prevBal, curBal) => {
        const acc = prevBal;
        if (curBal.type === 'income') {
          acc.income += Number(curBal.value);
        } else if (curBal.type === 'outcome') {
          acc.outcome += Number(curBal.value);
        }
        return acc;
      },
      { income: 0, outcome: 0, total: 0 },
    );

    const total = income - outcome;

    return { income, outcome, total };
  }
}

export default TransactionsRepository;
