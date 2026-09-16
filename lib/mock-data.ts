export type Product = {
  id: string
  name: string
  sku: string
  barcode: string
  price: number
  stock: number
  unit: string
  quantityStep: number
  categoryId: string
  image?: string
  tax?: number
  discount?: number
}

export type Category = {
  id: string
  name: string
  image?: string
}

export const CATEGORIES: Category[] = [
  { id: "all", name: "All Items" },
  { id: "c1", name: "Fresh Produce" },
  { id: "c2", name: "Dairy & Eggs" },
  { id: "c3", name: "Bakery" },
  { id: "c4", name: "Meat & Seafood" },
  { id: "c5", name: "Beverages" },
  { id: "c6", name: "Snacks" },
  { id: "c7", name: "Pantry" },
  { id: "c8", name: "Frozen Foods" },
  { id: "c9", name: "Personal Care" },
  { id: "c10", name: "Household" }
]

export const PRODUCTS: Product[] = [
  { id: "p1", name: "Organic Honeycrisp Apples", sku: "APP-001", barcode: "100000000001", price: 3.99, stock: 150, unit: "lb", quantityStep: 0.1, categoryId: "c1" },
  { id: "p2", name: "Cavendish Bananas", sku: "BAN-001", barcode: "100000000002", price: 1.29, stock: 200, unit: "lb", quantityStep: 0.1, categoryId: "c1" },
  { id: "p3", name: "Organic Whole Milk 1 Gal", sku: "MILK-001", barcode: "100000000003", price: 4.29, stock: 50, unit: "jug", quantityStep: 1, categoryId: "c2" },
  { id: "p4", name: "Free Range Large Eggs 12ct", sku: "EGG-001", barcode: "100000000004", price: 5.49, stock: 80, unit: "carton", quantityStep: 1, categoryId: "c2" },
  { id: "p5", name: "Whole Artisan Sourdough", sku: "BREAD-001", barcode: "100000000005", price: 5.99, stock: 30, unit: "loaf", quantityStep: 1, categoryId: "c3" },
  { id: "p6", name: "Boneless Skinless Chicken Breast", sku: "CHK-001", barcode: "100000000006", price: 6.49, stock: 60, unit: "lb", quantityStep: 0.5, categoryId: "c4" },
  { id: "p7", name: "Wild Caught Salmon Fillet", sku: "SLM-001", barcode: "100000000007", price: 12.99, stock: 25, unit: "lb", quantityStep: 0.5, categoryId: "c4" },
  { id: "p8", name: "Coca Cola 12-Pack", sku: "SODA-001", barcode: "100000000008", price: 6.99, stock: 120, unit: "pack", quantityStep: 1, categoryId: "c5" },
  { id: "p9", name: "100% Orange Juice 52oz", sku: "OJ-001", barcode: "100000000009", price: 3.99, stock: 75, unit: "bottle", quantityStep: 1, categoryId: "c5" },
  { id: "p10", name: "Classic Potato Chips", sku: "CHIP-001", barcode: "100000000010", price: 4.49, stock: 90, unit: "bag", quantityStep: 1, categoryId: "c6" },
  { id: "p11", name: "Dark Chocolate Bar 70%", sku: "CHOC-001", barcode: "100000000011", price: 2.99, stock: 200, unit: "bar", quantityStep: 1, categoryId: "c6" },
  { id: "p12", name: "Jasmine Rice 5lb", sku: "RICE-001", barcode: "100000000012", price: 8.99, stock: 40, unit: "bag", quantityStep: 1, categoryId: "c7" },
  { id: "p13", name: "Extra Virgin Olive Oil", sku: "OIL-001", barcode: "100000000013", price: 14.99, stock: 35, unit: "bottle", quantityStep: 1, categoryId: "c7" },
  { id: "p14", name: "Pepperoni Frozen Pizza", sku: "PIZ-001", barcode: "100000000014", price: 7.99, stock: 65, unit: "box", quantityStep: 1, categoryId: "c8" },
  { id: "p15", name: "Vanilla Bean Ice Cream 1.5qt", sku: "ICE-001", barcode: "100000000015", price: 5.99, stock: 45, unit: "tub", quantityStep: 1, categoryId: "c8" }
]
