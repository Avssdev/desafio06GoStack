import { getCustomRepository, getRepository, In } from 'typeorm';

import csvParser from 'csv-parse';
import fs from 'fs';

import AppError from '../errors/AppError';

import Category from '../models/Category';
import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(csvFilename: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    const transactions: CSVTransaction[] = [];
    const csvCategories: string[] = [];

    const readStream = fs.createReadStream(csvFilename);

    const parsedCSV = readStream.pipe(csvParser({ from_line: 2 }));

    parsedCSV.on('data', async data => {
      const [title, type, value, category] = data.map((cell: string) => {
        return cell.trim();
      });

      if (!title || !type || !value) return;

      csvCategories.push(category);
      transactions.push({ title, type, value, category });
    });

    await new Promise(resolve => parsedCSV.on('end', resolve));

    if (!csvCategories || csvCategories.length <= 0) {
      await fs.promises.unlink(csvFilename);
      throw new AppError('No categories found');
    }

    if (!transactions || transactions.length <= 0) {
      await fs.promises.unlink(csvFilename);
      throw new AppError('No transactions found');
    }

    const existentsCategories = await categoriesRepository.find({
      where: { title: In(csvCategories) },
    });

    const existentsCategoriesTitle = existentsCategories.map(
      (category: Category) => category.title,
    );

    const addCategoryTitles = csvCategories
      .filter(category => !existentsCategoriesTitle.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({ title })),
    );

    await categoriesRepository.save(newCategories);

    const finalCategories = [...newCategories, ...existentsCategories];

    const createdTransactions = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    await transactionsRepository.save(createdTransactions);

    await fs.promises.unlink(csvFilename);

    return createdTransactions;
  }
}

export default ImportTransactionsService;
