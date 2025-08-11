import type { Formula, FunctionDoc } from '../../core/src/index.ts';
import { ulid } from '../../core/src/index.ts';

export interface BackfillData {
  formulas: Formula[];
  functions: FunctionDoc[];
}

export function createBackfillData(documentId: string, spanId: string): BackfillData {
  const formulas: Formula[] = [
    {
      id: ulid(),
      documentId,
      name: 'Net Profit Margin',
      expression: 'Net Profit Margin = Net Income / Revenue',
      variables: [
        { name: 'Net Income', description: 'Total profit after all expenses, taxes, and interest' },
        { name: 'Revenue', description: 'Total income from sales or services' }
      ],
      notes: [
        'Expressed as a percentage by multiplying by 100',
        'Higher values indicate better profitability',
        'Industry benchmarks vary significantly'
      ],
      span_ids: [spanId],
      confidence: 1.0,
      tags: ['profitability', 'financial-metrics']
    },
    {
      id: ulid(),
      documentId,
      name: 'Operating Margin',
      expression: 'Operating Margin = Operating Income / Revenue',
      variables: [
        { name: 'Operating Income', description: 'Earnings before interest and taxes (EBIT)' },
        { name: 'Revenue', description: 'Total income from sales or services' }
      ],
      notes: [
        'Measures operational efficiency',
        'Excludes non-operating income and expenses',
        'Expressed as a percentage'
      ],
      span_ids: [spanId],
      confidence: 1.0,
      tags: ['profitability', 'financial-metrics']
    },
    {
      id: ulid(),
      documentId,
      name: 'Gross Margin',
      expression: 'Gross Margin = Gross Profit / Revenue',
      variables: [
        { name: 'Gross Profit', description: 'Revenue minus Cost of Goods Sold (COGS)' },
        { name: 'Revenue', description: 'Total income from sales or services' }
      ],
      notes: [
        'Indicates pricing power and cost control',
        'First measure of profitability in income statement',
        'Expressed as a percentage'
      ],
      span_ids: [spanId],
      confidence: 1.0,
      tags: ['profitability', 'financial-metrics']
    },
    {
      id: ulid(),
      documentId,
      name: 'Return on Assets (ROA)',
      expression: 'ROA = Net Income / Average Total Assets',
      variables: [
        { name: 'Net Income', description: 'Total profit after all expenses' },
        { name: 'Average Total Assets', description: 'Mean of beginning and ending total assets for the period' }
      ],
      notes: [
        'Measures how efficiently assets generate profit',
        'Higher values indicate better asset utilization',
        'Expressed as a percentage'
      ],
      span_ids: [spanId],
      confidence: 1.0,
      tags: ['profitability', 'financial-metrics']
    },
    {
      id: ulid(),
      documentId,
      name: 'Return on Equity (ROE)',
      expression: 'ROE = Net Income / Average Shareholders\' Equity',
      variables: [
        { name: 'Net Income', description: 'Total profit after all expenses' },
        { name: 'Average Shareholders\' Equity', description: 'Mean of beginning and ending shareholders\' equity for the period' }
      ],
      notes: [
        'Measures return generated on shareholders\' investment',
        'Key metric for equity investors',
        'Expressed as a percentage'
      ],
      span_ids: [spanId],
      confidence: 1.0,
      tags: ['profitability', 'financial-metrics']
    }
  ];

  const functions: FunctionDoc[] = [
    {
      id: ulid(),
      documentId,
      name: 'Calculate Net Profit Margin',
      purpose: 'Compute the net profit margin to assess overall company profitability',
      inputs: [
        { name: 'Net Income', type: 'number', required: true, description: 'Company\'s total profit after all expenses' },
        { name: 'Revenue', type: 'number', required: true, description: 'Company\'s total sales or service income' }
      ],
      preconditions: [
        'Net Income and Revenue must be from the same accounting period',
        'Revenue must be greater than 0'
      ],
      steps: [
        { n: 1, text: 'Obtain Net Income from the income statement' },
        { n: 2, text: 'Obtain Revenue (or Net Sales) from the income statement' },
        { n: 3, text: 'Divide Net Income by Revenue' },
        { n: 4, text: 'Multiply result by 100 to express as percentage' }
      ],
      outputs: [
        { name: 'Net Profit Margin', type: 'percentage', description: 'Percentage indicating profit efficiency' }
      ],
      failure_modes: [
        'Division by zero if Revenue is 0',
        'Negative margin if company has net loss',
        'Misleading results if periods don\'t match'
      ],
      examples: [
        {
          input: { netIncome: 50000, revenue: 500000 },
          output: { netProfitMargin: 10.0 },
          notes: 'Company generates $0.10 profit per $1.00 of revenue'
        }
      ],
      tags: ['profitability', 'financial-metrics'],
      span_ids: [spanId],
      confidence: 1.0
    },
    {
      id: ulid(),
      documentId,
      name: 'Calculate Return on Assets',
      purpose: 'Measure how efficiently a company uses its assets to generate profit',
      inputs: [
        { name: 'Net Income', type: 'number', required: true, description: 'Company\'s total profit after all expenses' },
        { name: 'Beginning Total Assets', type: 'number', required: true, description: 'Total assets at period start' },
        { name: 'Ending Total Assets', type: 'number', required: true, description: 'Total assets at period end' }
      ],
      preconditions: [
        'Assets and Net Income must be from the same accounting period',
        'Assets must be positive values'
      ],
      steps: [
        { n: 1, text: 'Obtain Net Income from the income statement' },
        { n: 2, text: 'Obtain Beginning Total Assets from balance sheet' },
        { n: 3, text: 'Obtain Ending Total Assets from balance sheet' },
        { n: 4, text: 'Calculate Average Total Assets: (Beginning + Ending) / 2' },
        { n: 5, text: 'Divide Net Income by Average Total Assets' },
        { n: 6, text: 'Multiply result by 100 to express as percentage' }
      ],
      outputs: [
        { name: 'Return on Assets', type: 'percentage', description: 'Percentage indicating asset efficiency' }
      ],
      failure_modes: [
        'Division by zero if average assets is 0',
        'Negative ROA if company has net loss',
        'Distorted results from asset write-downs or acquisitions'
      ],
      examples: [
        {
          input: { netIncome: 100000, beginningAssets: 1000000, endingAssets: 1200000 },
          output: { returnOnAssets: 9.09 },
          notes: 'Company generates $0.09 profit per $1.00 of assets'
        }
      ],
      tags: ['profitability', 'financial-metrics'],
      span_ids: [spanId],
      confidence: 1.0
    }
  ];

  return { formulas, functions };
}