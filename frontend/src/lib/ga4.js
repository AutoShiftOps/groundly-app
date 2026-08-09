import ReactGA from "react-ga4";

const GA4_MEASUREMENT_ID = import.meta.env.VITE_GA4_ID;

export function initGA4() {
  if (GA4_MEASUREMENT_ID) {
    ReactGA.initialize(GA4_MEASUREMENT_ID);
  }
}

export function trackEvent(name, params = {}) {
  ReactGA.event(name, params);
}

export function trackPageview(path) {
  ReactGA.send({ hitType: "pageview", page: path });
}
