export function calculateHPMax(con: number, siz: number): number {
  return Math.floor((con + siz) / 10);
}

export function calculateMPMax(pow: number): number {
  return Math.floor(pow / 5);
}

export function calculateSanityMax(pow: number): number {
  return pow * 5;
}

export function calculateDodgeBase(dex: number): number {
  return Math.floor(dex / 2);
}

export function calculateOwnLanguageBase(edu: number): number {
  return edu;
}

export function calculateMovementRate(str: number, dex: number, siz: number, age: number): number {
  let base = 8;
  if (str > siz && dex > siz) {
    base = 9;
  } else if (str < siz && dex < siz) {
    base = 7;
  }
  
  let penalty = 0;
  if (age >= 80) penalty = 5;
  else if (age >= 70) penalty = 4;
  else if (age >= 60) penalty = 3;
  else if (age >= 50) penalty = 2;
  else if (age >= 40) penalty = 1;

  return Math.max(1, base - penalty);
}
