import ipipData from '../data/ipip-neo-120.json';
import type {
  DomainScore,
  FacetScore,
  IPIPBank,
  IPIPItem,
  IPIPNeoResult,
} from './calibrationTypes';

export const IPIP_120_BANK: IPIPBank = ipipData as IPIPBank;

export const DOMAINS: Array<'N' | 'E' | 'O' | 'A' | 'C'> = ['N', 'E', 'O', 'A', 'C'];

export const FACET_NAMES: Record<string, string> = {
  N1: 'Anxiety',
  N2: 'Anger',
  N3: 'Depression',
  N4: 'Self-Consciousness',
  N5: 'Immoderation',
  N6: 'Vulnerability',
  E1: 'Friendliness',
  E2: 'Gregariousness',
  E3: 'Assertiveness',
  E4: 'Activity Level',
  E5: 'Excitement-Seeking',
  E6: 'Cheerfulness',
  O1: 'Imagination',
  O2: 'Artistic Interests',
  O3: 'Emotionality',
  O4: 'Adventurousness',
  O5: 'Intellect',
  O6: 'Liberalism',
  A1: 'Trust',
  A2: 'Morality',
  A3: 'Altruism',
  A4: 'Cooperation',
  A5: 'Modesty',
  A6: 'Sympathy',
  C1: 'Self-Efficacy',
  C2: 'Orderliness',
  C3: 'Dutifulness',
  C4: 'Achievement-Striving',
  C5: 'Self-Discipline',
  C6: 'Cautiousness',
};

export const DOMAIN_NAMES: Record<'N' | 'E' | 'O' | 'A' | 'C', string> = {
  N: 'Neuroticism / Emotional Stability',
  E: 'Extraversion',
  O: 'Openness to Experience',
  A: 'Agreeableness',
  C: 'Conscientiousness',
};

/**
 * Score a single item response (1..5).
 * Positive-keyed: score = r.
 * Reverse-keyed: score = 6 - r.
 */
export function scoreItem(item: IPIPItem, rawValue: number): number {
  if (rawValue < 1 || rawValue > 5) {
    throw new Error(`Invalid response value ${rawValue}. Must be between 1 and 5.`);
  }
  return item.key === '+' ? rawValue : 6 - rawValue;
}

/**
 * Calculate full IPIP-NEO-120 scores from a response map.
 * Enforces strict missingness:
 * - Facets score only with 4/4 answers.
 * - Domains score only with 24/24 answers.
 */
export function scoreIpipNeo120(responses: Record<string, number>): IPIPNeoResult {
  const items = IPIP_120_BANK.items;
  const itemsByFacet: Record<string, IPIPItem[]> = {};

  for (const item of items) {
    if (!itemsByFacet[item.facet]) itemsByFacet[item.facet] = [];
    itemsByFacet[item.facet].push(item);
  }

  const facets: Record<string, FacetScore | null> = {};
  const answeredCount = Object.keys(responses).length;

  for (const [facetCode, facetItems] of Object.entries(itemsByFacet)) {
    const answeredFacetItems = facetItems.filter((it) => typeof responses[it.id] === 'number');
    if (answeredFacetItems.length < 4) {
      facets[facetCode] = null;
      continue;
    }

    const raw = facetItems.reduce((acc, it) => acc + scoreItem(it, responses[it.id]), 0);
    const mean = raw / 4;
    facets[facetCode] = {
      raw,
      mean,
      n: 4,
      possibleRangePosition: 25 * (mean - 1),
    };
  }

  const domains: Record<'N' | 'E' | 'O' | 'A' | 'C', DomainScore | null> = {
    N: null,
    E: null,
    O: null,
    A: null,
    C: null,
  };

  for (const domain of DOMAINS) {
    const domainFacets = Object.entries(facets).filter(([code]) => code.startsWith(domain));
    const allFacetsComplete = domainFacets.length === 6 && domainFacets.every(([, f]) => f !== null);

    if (allFacetsComplete) {
      const validFacets = domainFacets.map(([, f]) => f as FacetScore);
      const raw = validFacets.reduce((acc, f) => acc + f.raw, 0);
      const mean = raw / 24;
      domains[domain] = {
        raw,
        mean,
        n: 24,
        possibleRangePosition: 25 * (mean - 1),
        facets: Object.fromEntries(domainFacets.map(([c, f]) => [c, f!])),
      };
    }
  }

  return {
    bank: IPIP_120_BANK.bank,
    bankVersion: IPIP_120_BANK.bankVersion,
    answeredCount,
    isComplete: answeredCount === 120 && Object.values(domains).every((d) => d !== null),
    domains,
    facets,
  };
}
