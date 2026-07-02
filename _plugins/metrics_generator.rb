# Build-time self-metrics. Computes counts straight off the repo (novel
# chapters, chapters added this month, log entries per world, posts) and
# merges them with hand-maintained values from _data/metrics.yml (things
# that cannot be derived, e.g. ghsa_credits). The result lands on
# site.data['generated_metrics'] for _includes/instrument-strip.html.
#
# Contract: this MUST NOT break the build. Every derivation is guarded and
# defaults to 0 when data is missing.
module Jekyll
  class MetricsGenerator < Generator
    safe true
    priority :low

    def generate(site)
      metrics = {}

      begin
        chapters = collection_docs(site, 'novel')
        metrics['novel_chapters'] = chapters.size
        metrics['novel_chapters_month'] = chapters_this_month(chapters)

        logs = collection_docs(site, 'log')
        by_world = Hash.new(0)
        logs.each do |doc|
          world = doc.data['world']
          by_world[world] += 1 if world
        end
        metrics['log_total'] = logs.size
        # plain Hash so Liquid can iterate it as key/value pairs
        metrics['log_by_world'] = Hash[by_world.sort]

        metrics['posts'] = site.posts.docs.size

        metrics['years_online'] = years_online(site)
      rescue => e
        Jekyll.logger.warn 'MetricsGenerator:', "derivation failed (#{e.message}); using defaults"
      end

      # Fold in hand-maintained numbers without clobbering derived ones.
      manual = site.data['metrics'] || {}
      manual.each { |key, value| metrics[key] = value unless metrics.key?(key) }
      metrics['ghsa_credits'] ||= 0

      site.data['generated_metrics'] = metrics
    end

    private

    def collection_docs(site, name)
      collection = site.collections[name]
      collection ? collection.docs : []
    end

    def chapters_this_month(chapters)
      dated = chapters.select { |doc| doc.data['date'] }
      # No chapter carries a date: fall back to the running total.
      return chapters.size if dated.empty?

      now = Time.now
      dated.count do |doc|
        date = doc.data['date']
        date.year == now.year && date.month == now.month
      end
    end

    def years_online(site)
      first = site.config['first_published']
      return 0 unless first.is_a?(Integer)

      span = Time.now.year - first
      span.positive? ? span : 0
    end
  end
end
