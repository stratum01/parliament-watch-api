export const mockVotes = [
  {
    id: "v1",
    number: 928,
    date: "2024-12-17",
    description: {
      en: "Motion on International Trade Agreement with United States",
      fr: "Motion sur l'accord commercial international avec les États-Unis"
    },
    result: "Passed",
    yea_total: 177,
    nay_total: 140,
    paired_total: 0,
    bill_url: null
  },
  {
    id: "v2",
    number: 927,
    date: "2024-12-17",
    description: {
      en: "Economic Statement Implementation Act",
      fr: "Loi d'exécution de l'énoncé économique"
    },
    result: "Passed",
    yea_total: 296,
    nay_total: 17,
    paired_total: 0,
    bill_url: "/bills/44-1/C-123/"
  },
  {
    id: "v3",
    number: 926,
    date: "2024-12-16",
    description: {
      en: "Motion on Softwood Lumber Industry Support",
      fr: "Motion sur le soutien à l'industrie du bois d'oeuvre"
    },
    result: "Failed",
    yea_total: 144,
    nay_total: 167,
    paired_total: 0,
    bill_url: "/bills/44-1/C-45/"
  },
  {
    id: "v4",
    number: 925,
    date: "2024-12-15",
    description: {
      en: "Climate Action Implementation Bill",
      fr: "Projet de loi sur la mise en œuvre de l'action climatique"
    },
    result: "Passed",
    yea_total: 189,
    nay_total: 132,
    paired_total: 0,
    bill_url: null
  }
];

export const mockBills = [
  {
    id: "b1",
    number: "C-79",
    name: {
      en: "An Act for granting to His Majesty certain sums of money for the federal public administration",
      fr: "Loi portant octroi à Sa Majesté de crédits pour l'administration publique fédérale"
    },
    introduced_date: "2024-12-01",
    status: "Third Reading",
    sponsor: "Hon. Chrystia Freeland",
    last_event: "Passed third reading (2024-12-10)",
    progress: 90,
    session: "44-1"
  },
  {
    id: "b2",
    number: "C-45",
    name: {
      en: "Cannabis Regulation Amendment Act",
      fr: "Loi modifiant la réglementation du cannabis"
    },
    introduced_date: "2024-11-15",
    status: "Committee",
    sponsor: "Hon. Mark Holland",
    last_event: "Referred to committee (2024-12-01)",
    progress: 60,
    session: "44-1"
  },
  {
    id: "b3",
    number: "C-56",
    name: {
      en: "Affordable Housing and Public Transit Act",
      fr: "Loi sur le logement abordable et le transport en commun"
    },
    introduced_date: "2024-11-01",
    status: "Second Reading",
    sponsor: "Hon. Sean Fraser",
    last_event: "Debate at second reading (2024-11-20)",
    progress: 40,
    session: "44-1"
  }
];

export const mockMembers = [
  {
    id: "m1",
    name: "Marco Mendicino",
    party: "Liberal",
    constituency: "Eglinton—Lawrence",
    province: "ON",
    email: "marco.mendicino@parl.gc.ca",
    phone: "613-992-6361",
    photo_url: "/api/placeholder/400/400",
    roles: ["Minister of Public Safety"],
    office: {
      address: "511 Lawrence Avenue West, Toronto, Ontario, M6A 1A3",
      phone: "416-781-5583"
    }
  },
  {
    id: "m2",
    name: "Pierre Poilievre",
    party: "Conservative",
    constituency: "Carleton",
    province: "ON",
    email: "pierre.poilievre@parl.gc.ca",
    phone: "613-992-2772",
    photo_url: "/api/placeholder/400/400",
    roles: ["Leader of the Official Opposition"],
    office: {
      address: "1139 Mill Street, Manotick, Ontario, K4M 1A5",
      phone: "613-692-3331"
    }
  },
  {
    id: "m3",
    name: "Jagmeet Singh",
    party: "NDP",
    constituency: "Burnaby South",
    province: "BC",
    email: "jagmeet.singh@parl.gc.ca",
    phone: "613-995-7224",
    photo_url: "/api/placeholder/400/400",
    roles: ["Leader of the New Democratic Party"],
    office: {
      address: "4940 Kingsway, Burnaby, British Columbia, V5H 2E2",
      phone: "604-291-8863"
    }
  }
];

export const mockMemberVotes = {
  "m1": [
    {
      bill: "C-79",
      description: "An Act for granting to His Majesty certain sums of money",
      date: "2024-12-10",
      vote: "Yea",
      result: "Passed"
    },
    {
      bill: "Motion",
      description: "Opposition Motion (Cost of living relief for Canadians)",
      date: "2024-12-09",
      vote: "Nay",
      result: "Failed"
    },
    {
      bill: "C-45",
      description: "Cannabis Regulation Amendment",
      date: "2024-12-08",
      vote: "Yea",
      result: "Passed"
    },
    {
      bill: "Motion",
      description: "Motion to proceed to Orders of the Day",
      date: "2024-12-05",
      vote: "Yea",
      result: "Failed"
    }
  ]
};