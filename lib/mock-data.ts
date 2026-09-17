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
  { id: "c1", name: "Biryani" },
  { id: "c2", name: "South Indian Starters - Non-Veg" },
  { id: "c3", name: "Chinese Starters" },
  { id: "c4", name: "Chinese Rice" },
  { id: "c5", name: "Noodles" },
  { id: "c6", name: "Juices" },
  { id: "c7", name: "Mojito" },
  { id: "c8", name: "Breads / Parotta" },
  { id: "c9", name: "Egg" },
  { id: "c10", name: "Gravies" },
  { id: "c11", name: "Veg Starters" }
]

export const PRODUCTS: Product[] = [
  // Biryani
  { id: "p1", name: "Chicken Biryani", sku: "BIR-01", barcode: "1001", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c1" },
  { id: "p2", name: "Mutton Biryani (Dome Biryani)", sku: "BIR-02", barcode: "1002", price: 250, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c1" },
  { id: "p3", name: "Naatu Kozhi Biryani", sku: "BIR-03", barcode: "1003", price: 240, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c1" },
  { id: "p4", name: "Egg Biryani", sku: "BIR-04", barcode: "1004", price: 130, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c1" },
  { id: "p5", name: "Ghee Rice", sku: "BIR-05", barcode: "1005", price: 100, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c1" },
  { id: "p6", name: "65 Biryani", sku: "BIR-06", barcode: "1006", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c1" },

  // South Indian Starters – Non-Veg
  { id: "p7", name: "Chicken 65", sku: "SIS-01", barcode: "2001", price: 140, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p8", name: "Pepper Chicken", sku: "SIS-02", barcode: "2002", price: 150, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p9", name: "Pallipalayam Chicken", sku: "SIS-03", barcode: "2003", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p10", name: "Chicken Chukka", sku: "SIS-04", barcode: "2004", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p11", name: "Mutton Chukka", sku: "SIS-05", barcode: "2005", price: 220, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p12", name: "Naatu Kozhi Ghee Chukka", sku: "SIS-06", barcode: "2006", price: 0, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p13", name: "Karasara Chicken + Mutton", sku: "SIS-07", barcode: "2007", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p14", name: "Fish Fry", sku: "SIS-08", barcode: "2008", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p15", name: "Prawn Fry", sku: "SIS-09", barcode: "2009", price: 220, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p16", name: "Rajamundhiri Chicken 65", sku: "SIS-10", barcode: "2010", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p17", name: "Onion Pepper Fry", sku: "SIS-11", barcode: "2011", price: 0, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p18", name: "Mutton Bone Fry", sku: "SIS-12", barcode: "2012", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p19", name: "Kaadai Egg Fry", sku: "SIS-13", barcode: "2013", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },
  { id: "p20", name: "Kaadai 65", sku: "SIS-14", barcode: "2014", price: 120, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c2" },

  // Chinese Starters
  { id: "p21", name: "Chicken Lollipop", sku: "CHI-01", barcode: "3001", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p22", name: "Chilli Chicken", sku: "CHI-02", barcode: "3002", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p23", name: "Dragon Chicken", sku: "CHI-03", barcode: "3003", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p24", name: "Garlic Chicken", sku: "CHI-04", barcode: "3004", price: 190, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p25", name: "Chicken Manchurian", sku: "CHI-05", barcode: "3005", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p26", name: "Tapan Chicken", sku: "CHI-06", barcode: "3006", price: 190, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p27", name: "Lemon Chicken", sku: "CHI-07", barcode: "3007", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p28", name: "Chilli Gobi Manchurian", sku: "CHI-08", barcode: "3008", price: 140, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p29", name: "Chilli Mushroom Manchurian", sku: "CHI-09", barcode: "3009", price: 140, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },
  { id: "p30", name: "Chilli Paneer Manchurian", sku: "CHI-10", barcode: "3010", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c3" },

  // Chinese Rice
  { id: "p31", name: "Chicken Fried Rice", sku: "RIC-01", barcode: "4001", price: 140, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p32", name: "Mutton Fried Rice", sku: "RIC-02", barcode: "4002", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p33", name: "Egg Fried Rice", sku: "RIC-03", barcode: "4003", price: 120, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p34", name: "Veg Fried Rice (Mushroom, Paneer)", sku: "RIC-04", barcode: "4004", price: 110, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p35", name: "Chicken Schezwan Rice", sku: "RIC-05", barcode: "4005", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p36", name: "Mutton Schezwan Rice (Full)", sku: "RIC-06", barcode: "4006", price: 200, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p36b", name: "Mutton Schezwan Rice (Half)", sku: "RIC-06b", barcode: "40062", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p37", name: "Egg Schezwan Rice", sku: "RIC-07", barcode: "4007", price: 120, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },
  { id: "p38", name: "Veg Schezwan Rice (Mushroom, Paneer)", sku: "RIC-08", barcode: "4008", price: 130, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c4" },

  // Noodles
  { id: "p39", name: "Chicken Noodles", sku: "NOD-01", barcode: "5001", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },
  { id: "p40", name: "Mutton Noodles", sku: "NOD-02", barcode: "5002", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },
  { id: "p41", name: "Egg Noodles", sku: "NOD-03", barcode: "5003", price: 130, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },
  { id: "p42", name: "Veg Noodles (Paneer, Mushroom)", sku: "NOD-04", barcode: "5004", price: 130, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },
  { id: "p43", name: "Schezwan Veg Noodles", sku: "NOD-05", barcode: "5005", price: 140, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },
  { id: "p44", name: "Schezwan Chicken Noodles", sku: "NOD-06", barcode: "5006", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },
  { id: "p45", name: "Schezwan Mutton Noodles", sku: "NOD-07", barcode: "5007", price: 200, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },
  { id: "p46", name: "Schezwan Egg Noodles", sku: "NOD-08", barcode: "5008", price: 140, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c5" },

  // Juices
  { id: "p47", name: "Apple Juice", sku: "JUI-01", barcode: "6001", price: 80, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p48", name: "Pineapple Juice", sku: "JUI-02", barcode: "6002", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p49", name: "Lemon Juice", sku: "JUI-03", barcode: "6003", price: 40, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p50", name: "Lemon Soda (Sweet & Salt)", sku: "JUI-04", barcode: "6004", price: 50, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p51", name: "Watermelon Juice", sku: "JUI-05", barcode: "6005", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p52", name: "Pomegranate Juice", sku: "JUI-06", barcode: "6006", price: 80, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p53", name: "Orange Juice", sku: "JUI-07", barcode: "6007", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p54", name: "Grape Juice", sku: "JUI-08", barcode: "6008", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p55", name: "Muskmelon Juice", sku: "JUI-09", barcode: "6009", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },
  { id: "p56", name: "Elaneer Payasam", sku: "JUI-10", barcode: "6010", price: 120, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c6" },

  // Mojito
  { id: "p57", name: "Green Apple Mojito", sku: "MOJ-01", barcode: "7001", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c7" },
  { id: "p58", name: "Blueberry Mojito", sku: "MOJ-02", barcode: "7002", price: 100, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c7" },
  { id: "p59", name: "Lemon Mint Mojito", sku: "MOJ-03", barcode: "7003", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c7" },
  { id: "p60", name: "Watermelon Mojito", sku: "MOJ-04", barcode: "7004", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c7" },
  { id: "p61", name: "Pineapple Mojito", sku: "MOJ-05", barcode: "7005", price: 70, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c7" },
  { id: "p62", name: "Musk Melon Mojito", sku: "MOJ-06", barcode: "7006", price: 0, stock: 999, unit: "glass", quantityStep: 1, categoryId: "c7" },

  // Breads / Parotta
  { id: "p63", name: "Parotta", sku: "PAR-01", barcode: "8001", price: 20, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p64", name: "Bun Parotta", sku: "PAR-02", barcode: "8002", price: 25, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p65", name: "Nool Parotta", sku: "PAR-03", barcode: "8003", price: 25, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p66", name: "Coin Parotta (Set)", sku: "PAR-04", barcode: "8004", price: 40, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p66b", name: "Coin Parotta (Single)", sku: "PAR-04b", barcode: "80042", price: 25, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p67", name: "Veechu Parotta - Egg", sku: "PAR-05", barcode: "8005", price: 35, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p68", name: "Veechu Parotta - Plain", sku: "PAR-06", barcode: "8006", price: 30, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p69", name: "Kothu Parotta - Egg", sku: "PAR-07", barcode: "8007", price: 90, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c8" },
  { id: "p70", name: "Kothu Parotta - Chicken", sku: "PAR-08", barcode: "8008", price: 130, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c8" },
  { id: "p71", name: "Kothu Parotta - Mutton", sku: "PAR-09", barcode: "8009", price: 180, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c8" },
  { id: "p72", name: "Vazhai Ilai Parotta", sku: "PAR-10", barcode: "8010", price: 140, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c8" },
  { id: "p73", name: "Vazhai Ilai Parotta - Mutton", sku: "PAR-11", barcode: "8011", price: 160, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c8" },
  { id: "p74", name: "Wheat Parotta", sku: "PAR-12", barcode: "8012", price: 30, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },
  { id: "p75", name: "Chilli Parotta", sku: "PAR-13", barcode: "8013", price: 120, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c8" },
  { id: "p76", name: "Pizza Parotta", sku: "PAR-14", barcode: "8014", price: 130, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c8" },
  { id: "p77", name: "Curry Dosai", sku: "PAR-15", barcode: "8015", price: 120, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c8" },

  // Egg
  { id: "p78", name: "Omelet", sku: "EGG-01", barcode: "9001", price: 20, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c9" },
  { id: "p79", name: "Boiled Egg", sku: "EGG-02", barcode: "9002", price: 25, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c9" },
  { id: "p80", name: "Egg Podimas", sku: "EGG-03", barcode: "9003", price: 40, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c9" },
  { id: "p81", name: "Kalakki", sku: "EGG-04", barcode: "9004", price: 30, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c9" },
  { id: "p82", name: "Half Boil", sku: "EGG-05", barcode: "9005", price: 20, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c9" },
  { id: "p83", name: "One Side", sku: "EGG-06", barcode: "9006", price: 20, stock: 999, unit: "pc", quantityStep: 1, categoryId: "c9" },

  // Gravies
  { id: "p84", name: "Chicken Gravy", sku: "GRA-01", barcode: "1101", price: 130, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p85", name: "Mutton Gravy", sku: "GRA-02", barcode: "1102", price: 180, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p86", name: "Kadai Chicken", sku: "GRA-03", barcode: "1103", price: 160, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p87", name: "Rajamundhiri Chicken Gravy", sku: "GRA-04", barcode: "1104", price: 180, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p88", name: "Hyderabadi Green Chicken", sku: "GRA-05", barcode: "1105", price: 160, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p89", name: "Chettinad Chicken", sku: "GRA-06", barcode: "1106", price: 160, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p90", name: "Mutton Rogan Josh", sku: "GRA-07", barcode: "1107", price: 220, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p91", name: "Mutton Chettinad", sku: "GRA-08", barcode: "1108", price: 220, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p92", name: "Pallipalayam Chicken + Mutton Gravy", sku: "GRA-09", barcode: "1109", price: 180, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },
  { id: "p93", name: "Mutton Bone Curry", sku: "GRA-10", barcode: "1110", price: 200, stock: 999, unit: "bowl", quantityStep: 1, categoryId: "c10" },

  // Veg Starters
  { id: "p94", name: "Paneer 65", sku: "VEG-01", barcode: "1201", price: 130, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c11" },
  { id: "p95", name: "Mushroom 65", sku: "VEG-02", barcode: "1202", price: 120, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c11" },
  { id: "p96", name: "Babycorn 65", sku: "VEG-03", barcode: "1203", price: 100, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c11" },
  { id: "p97", name: "Gobi 65", sku: "VEG-04", barcode: "1204", price: 100, stock: 999, unit: "plate", quantityStep: 1, categoryId: "c11" }
]
