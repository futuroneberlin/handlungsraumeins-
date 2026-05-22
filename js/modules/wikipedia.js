function titleCase(term) {
  return term.charAt(0).toUpperCase() + term.slice(1);
}

export function createWikipediaService() {
  const cache = new Map();

  return {
    async resolveRelations(fragments) {
      const termMap = new Map();

      fragments.forEach((fragment) => {
        fragment.terms.forEach((term) => {
          const bucket = termMap.get(term) ?? [];
          bucket.push(fragment.id);
          termMap.set(term, bucket);
        });
      });

      const relatedTerms = [...termMap.entries()]
        .filter(([, fragmentIds]) => fragmentIds.length >= 2)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 8);

      const relations = await Promise.all(
        relatedTerms.map(async ([term, fragmentIds]) => ({
          term,
          fragmentIds,
          wiki: await this.lookupTerm(term),
        }))
      );

      return relations;
    },

    async lookupTerm(term) {
      if (cache.has(term)) {
        return cache.get(term);
      }

      const fallback = {
        title: titleCase(term),
        extract: "Kein Wikipedia-Kontext verfügbar — der Begriff bleibt als lokale Relation im Raum aktiv.",
        url: `https://de.wikipedia.org/wiki/${encodeURIComponent(titleCase(term))}`,
      };

      try {
        const response = await fetch(
          `https://de.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
            term
          )}&utf8=1&format=json&origin=*`
        );
        const data = await response.json();
        const title = data?.query?.search?.[0]?.title;

        if (!title) {
          cache.set(term, fallback);
          return fallback;
        }

        const summaryResponse = await fetch(
          `https://de.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`
        );

        if (!summaryResponse.ok) {
          cache.set(term, fallback);
          return fallback;
        }

        const summary = await summaryResponse.json();
        const value = {
          title: summary.title ?? title,
          extract:
            summary.extract ??
            "Wikipedia liefert für diesen Begriff derzeit keinen Kurztext.",
          url:
            summary.content_urls?.desktop?.page ??
            `https://de.wikipedia.org/wiki/${encodeURIComponent(title)}`,
        };

        cache.set(term, value);
        return value;
      } catch (error) {
        console.warn("Wikipedia lookup failed", term, error);
        cache.set(term, fallback);
        return fallback;
      }
    },
  };
}
