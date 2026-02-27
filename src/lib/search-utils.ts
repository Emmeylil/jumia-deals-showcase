/**
 * Semantic search utilities for Jumia Deals Catalog.
 * Provides synonym mapping, text normalization, and stemming.
 */

// Common synonyms and abbreviations for retail products
const SYNONYM_MAP: Record<string, string[]> = {
    "tv": ["television", "tvs", "televisions", "smart tv", "led tv"],
    "television": ["tv", "tvs", "televisions"],
    "fridge": ["refrigerator", "fridges", "refrigerators", "deep freezer"],
    "refrigerator": ["fridge", "fridges", "refrigerators"],
    "phone": ["smartphone", "mobile", "cellphone", "android", "iphone"],
    "smartphone": ["phone", "mobile", "cellphone"],
    "laptop": ["computer", "notebook", "pc"],
    "computer": ["laptop", "pc", "desktop"],
    "machine": ["washer", "dryer"],
    "washer": ["washing machine", "machine"],
    "washing machine": ["washer", "machine"],
    "ac": ["air conditioner", "aircon", "cooling"],
    "air conditioner": ["ac", "aircon"],
    "fan": ["ventilator", "cooling"],
    "shoe": ["sneaker", "footwear", "boot"],
    "sneaker": ["shoe", "footwear"],
    "shirt": ["top", "t-shirt", "polo"],
    "top": ["shirt", "t-shirt"],
};

/**
 * Normalizes text by lowercasing, removing punctuation, and trimming.
 */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Basic stemming function to reduce words to their roots.
 */
export function stemTerm(term: string): string {
    if (term.length <= 3) return term;

    let stemmed = term;

    // Simple plural removal
    if (stemmed.endsWith("ies")) {
        stemmed = stemmed.slice(0, -3) + "y";
    } else if (stemmed.endsWith("ses") || stemmed.endsWith("xes") || stemmed.endsWith("zes") || stemmed.endsWith("ches") || stemmed.endsWith("shes")) {
        stemmed = stemmed.slice(0, -2);
    } else if (stemmed.endsWith("es")) {
        // Check if it's like 'fridges' -> 'fridge' or 'bikes' -> 'bike'
        // Usually if the char before 'es' is a consonant, we just remove 's'? 
        // Actually, 'fridges' -> 'fridge' is removing 's'.
        // 'boxes' -> 'box' is removing 'es'.
        stemmed = stemmed.slice(0, -1);
    } else if (stemmed.endsWith("s") && !stemmed.endsWith("ss")) {
        stemmed = stemmed.slice(0, -1);
    }

    // Common suffixes - only if the resulting word is long enough
    if (stemmed.length > 4) {
        if (stemmed.endsWith("ing")) {
            stemmed = stemmed.slice(0, -3);
        } else if (stemmed.endsWith("ed")) {
            stemmed = stemmed.slice(0, -2);
        } else if (stemmed.endsWith("er") && !stemmed.endsWith("her")) { // don't stem 'washer' to 'wash' if we want exact matches?
            // Actually keeping 'washer' might be better for some items, but letting it stem is okay if we have synonyms.
            stemmed = stemmed.slice(0, -2);
        }
    }

    return stemmed;
}

/**
 * Expands a query string into a list of search terms.
 */
export function expandQuery(query: string): string[] {
    const normalized = normalizeText(query);
    const words = normalized.split(" ");
    const expandedTerms = new Set<string>();

    words.forEach(word => {
        if (!word || word.length < 2) return;

        // Add original word
        expandedTerms.add(word);

        // Add synonyms for original word
        const synonyms = SYNONYM_MAP[word] || [];
        synonyms.forEach(syn => {
            normalizeText(syn).split(" ").forEach(sw => expandedTerms.add(sw));
        });

        // Add stem
        const stem = stemTerm(word);
        if (stem !== word) {
            expandedTerms.add(stem);
            // Check synonyms for stem
            const stemSynonyms = SYNONYM_MAP[stem] || [];
            stemSynonyms.forEach(syn => {
                normalizeText(syn).split(" ").forEach(sw => expandedTerms.add(sw));
            });
        }
    });

    return Array.from(expandedTerms);
}

/**
 * Returns a match score for a product against expanded queries.
 * Scores are higher for exact matches and matches in name vs category.
 */
export function getSemanticScore(
    product: { name: string; brand?: string; category?: string; displayName?: string },
    expandedQueries: string[]
): number {
    const searchableText = normalizeText(`${product.displayName || product.name} ${product.brand || ""} ${product.category || ""}`);
    const nameText = normalizeText(product.displayName || product.name);
    const brandText = normalizeText(product.brand || "");

    let score = 0;

    expandedQueries.forEach(queryTerm => {
        // Priority 1: Exact name match
        if (nameText === queryTerm) {
            score += 10;
        }
        // Priority 2: Brand match
        else if (brandText === queryTerm) {
            score += 8;
        }
        // Priority 3: Contains in name
        else if (nameText.includes(queryTerm)) {
            score += 5;
        }
        // Priority 4: Contains in searchable text
        else if (searchableText.includes(queryTerm)) {
            score += 2;
        }
    });

    return score;
}
