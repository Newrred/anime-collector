import koMessages from "../messages/ko.js";
import enMessages from "../messages/en.js";

const LOCALE_MESSAGES = {
  ko: koMessages,
  en: enMessages,
};

export function getMessages(locale = "ko") {
  return LOCALE_MESSAGES[locale] || koMessages;
}

export function getMessageGroup(locale = "ko", key) {
  return getMessages(locale)?.[key] || koMessages?.[key] || {};
}

export { LOCALE_MESSAGES };
