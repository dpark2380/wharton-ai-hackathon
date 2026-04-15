/**
 * lib/manager-accounts.ts
 * Simulated hotel manager accounts for the Expedia Partner Central demo.
 * Each account maps to one property in the dataset.
 */

export interface ManagerAccount {
  id: string;
  name: string;
  initial: string;
  title: string;
  propertyId: string;
  propertyName: string;
  city: string;
  country: string;
  starRating: number;
}

// Property IDs from the dataset, matched to traveler accounts where possible
// so the demo can show: guest submitted → manager sees it live.
export const MANAGER_ACCOUNTS: ManagerAccount[] = [
  {
    id: "mgr-pompei",
    name: "Giulia Ferrara",
    initial: "G",
    title: "General Manager",
    propertyId: "110f01b8ae518a0ee41047bce5c22572988a435e10ead72dc1af793bba8ce0b0",
    propertyName: "Hotel Forum Pompei",
    city: "Pompei",
    country: "Italy",
    starRating: 4,
  },
  {
    id: "mgr-broomfield",
    name: "David Walsh",
    initial: "D",
    title: "Director of Operations",
    propertyId: "db38b19b897dbece3e34919c662b3fd66d23b615395d11fb69264dd3a9b17723",
    propertyName: "Residence Inn Broomfield",
    city: "Broomfield",
    country: "United States",
    starRating: 3,
  },
  {
    id: "mgr-bangkok",
    name: "Natcha Siriwan",
    initial: "N",
    title: "Revenue Manager",
    propertyId: "e52d67a758ce4ad0229aacc97e5dfe89984c384c51a70208f9e0cc65c9cd4676",
    propertyName: "Amari Bangkok",
    city: "Bangkok",
    country: "Thailand",
    starRating: 5,
  },
  {
    id: "mgr-rome",
    name: "Marco Vitale",
    initial: "M",
    title: "Front Office Manager",
    propertyId: "823fb2499b4e37d99acb65e7198e75965d6496fd1c579f976205c0e6179206df",
    propertyName: "Hotel Artemide Rome",
    city: "Rome",
    country: "Italy",
    starRating: 4,
  },
  {
    id: "mgr-monterey",
    name: "Claire Nguyen",
    initial: "C",
    title: "Guest Experience Manager",
    propertyId: "fa014137b3ea9af6a90c0a86a1d099e46f7e56d6eb33db1ad1ec4bdac68c3caa",
    propertyName: "Monterey Plaza Hotel",
    city: "Monterey",
    country: "United States",
    starRating: 4,
  },
];

export const MANAGER_STORAGE_KEY = "awm_manager";
