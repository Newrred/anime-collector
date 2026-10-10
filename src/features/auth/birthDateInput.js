import {ageOnDate,calendarDay} from './simpleSignup.js';

// Preserve entered parts. Only a valid date becomes a DOB; never accept Date's rollover.
export function parseBirthDateParts({year='',month='',day=''}={},today=calendarDay()) {
 const invalid=(field,code)=>({birthDate:'',field,code});
 if(!/^\d{4}$/.test(year))return invalid('year','BIRTH_YEAR_REQUIRED');
 if(!/^\d{1,2}$/.test(month)||Number(month)<1||Number(month)>12)return invalid('month','BIRTH_MONTH_REQUIRED');
 if(!/^\d{1,2}$/.test(day)||Number(day)<1||Number(day)>31)return invalid('day','BIRTH_DAY_REQUIRED');
 const birthDate=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
 const date=new Date(Date.UTC(Number(year),Number(month)-1,Number(day)));
 if(date.getUTCFullYear()!==Number(year))return invalid('year','INVALID_BIRTH_DATE');
 if(date.getUTCMonth()!==Number(month)-1||date.getUTCDate()!==Number(day))return invalid('day','BIRTH_DAY_INVALID');
 if(birthDate>today) {
  const [currentYear,currentMonth]=today.split('-');
  return invalid(year>currentYear?'year':Number(month)>Number(currentMonth)?'month':'day','BIRTH_DATE_FUTURE');
 }
 try {ageOnDate(birthDate,today);}catch {return invalid('year','INVALID_BIRTH_DATE');}
 return {birthDate,field:null,code:null};
}
