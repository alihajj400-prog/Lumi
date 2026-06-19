import { NextResponse } from 'next/server'

export function GET() {
  const csv = [
    'name,name_ar,sku,barcode,category,unit,price_usd,price_lbp,cost_usd,reorder_level',
    'Cheese Burger,,BURGER-001,1234567890123,Food,piece,8.50,765000,3.00,5',
    'Pepsi 500ml,,PEPSI-500,9876543210987,Drinks,piece,2.00,180000,0.80,10',
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="lumi_products_template.csv"',
    },
  })
}
