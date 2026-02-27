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
            const normSyn = normalizeText(syn);
            expandedTerms.add(normSyn);
            if (normSyn.includes(" ")) {
                normSyn.split(" ").forEach(sw => {
                    if (sw.length > 3) expandedTerms.add(sw);
                });
            }
        });

        // Add stem
        const stem = stemTerm(word);
        if (stem !== word) {
            expandedTerms.add(stem);
            // Check synonyms for stem
            const stemSynonyms = SYNONYM_MAP[stem] || [];
            stemSynonyms.forEach(syn => {
                const normSyn = normalizeText(syn);
                expandedTerms.add(normSyn);
            });
        }
    });

    return Array.from(expandedTerms);
}

/**
 * Returns a match score for a product against a query.
 * Scores are higher for exact matches, prefix matches, and matching more query terms.
 */
export function getSemanticScore(
    product: { name: string; brand?: string; category?: string; displayName?: string },
    rawQuery: string
): number {
    const normalizedQuery = normalizeText(rawQuery);
    const queryTerms = normalizedQuery.split(" ").filter(t => t.length > 0);

    const searchName = normalizeText(product.displayName || product.name);
    const searchBrand = normalizeText(product.brand || "");
    const searchCategory = normalizeText(product.category || "");
    const fullText = `${searchName} ${searchBrand} ${searchCategory}`;

    let score = 0;

    // 1. Exact Name/Brand Match (Absolute top)
    if (searchName === normalizedQuery) score += 500;
    if (searchBrand === normalizedQuery) score += 400;

    // 2. Full phrase inclusion (Very high)
    if (searchName.includes(normalizedQuery)) score += 200;
    else if (searchBrand.includes(normalizedQuery)) score += 150;
    else if (fullText.includes(normalizedQuery)) score += 100;

    // 3. Exact prefix match boost (only if query is reasonably specific)
    if (normalizedQuery.length > 2) {
        if (searchName.startsWith(normalizedQuery)) score += 50;
        if (searchBrand.startsWith(normalizedQuery)) score += 40;
    }

    // 4. Individual word matches
    let matchedTermsCount = 0;
    const expandedQueries = expandQuery(rawQuery);

    expandedQueries.forEach(term => {
        const isOriginalWord = queryTerms.includes(term);

        // Stricter matching for short terms to avoid noise
        const regex = term.length < 3 ? new RegExp(`\\b${term}\\b`) : null;

        const matchesName = regex ? regex.test(searchName) : searchName.includes(term);
        const matchesBrand = regex ? regex.test(searchBrand) : searchBrand.includes(term);
        const matchesCategory = regex ? regex.test(searchCategory) : searchCategory.includes(term);

        if (matchesName || matchesBrand || matchesCategory) {
            if (isOriginalWord) {
                score += 30;
                matchedTermsCount++;
            } else {
                // Multi-word synonyms (like "deep freezer") should get a better score than single-word partials
                const weight = term.includes(" ") ? 15 : 8;
                score += weight;
            }

            // Field weighting
            if (matchesName) score += 10;
            if (matchesBrand) score += 5;
        }
    });

    // 5. Density/Precision boost: reward shorter names that match the query
    if (matchedTermsCount > 0) {
        const nameWordCount = searchName.split(" ").length;
        const densityBonus = Math.max(0, 10 - nameWordCount);
        score += densityBonus;
    }

    return score;
}
