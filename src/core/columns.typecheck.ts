import {columns} from './columns.js'

type ExampleRecord = {
  createdAt: string
  ownerName: string | null
  isOpen: boolean | null
  salary: number | null
}

void columns.date<ExampleRecord, 'createdAt'>('createdAt')
void columns.category<ExampleRecord, 'ownerName'>('ownerName')
void columns.boolean<ExampleRecord, 'isOpen'>('isOpen', {
  trueLabel: 'Open',
  falseLabel: 'Closed',
})
void columns.number<ExampleRecord, 'salary'>('salary')

// @ts-expect-error invalid field name should fail at compile time
void columns.date<ExampleRecord, 'missingField'>('missingField')

// @ts-expect-error wrong field type for number columns
void columns.number<ExampleRecord, 'ownerName'>('ownerName')

// @ts-expect-error wrong field type for boolean columns
void columns.boolean<ExampleRecord, 'salary'>('salary', {
  trueLabel: 'Yes',
  falseLabel: 'No',
})
