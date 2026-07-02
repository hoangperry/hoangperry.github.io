#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Ingest one OR MORE novels from the novel-pipeline output into the site.
#
# Source layout:  ~/novel-hwang/novel-list/output/<any-dir>/chapters/NN.md
#                 ~/novel-hwang/novel-list/output/<any-dir>/premise.md   (title source)
#
# For every source dir that contains a chapters/ folder this writes:
#   _novel/<slug>/NN.md      -> a chapter (permalink /novel/<slug>/NN/)
#   _novel/<slug>/index.html -> that novel's landing (permalink /novel/<slug>/)
# and it maintains _data/novels.yml (the library index). The slug is derived
# from the novel title so URLs stay meaningful.
#
# _data/novels.yml keeps a hand-editable `synopsis`, `tagline`, and `status`
# per novel: those are PRESERVED across re-runs (only slug/title/chapters are
# refreshed). Safe to re-run whenever chapters are added.
#
#   ruby scripts/ingest-novel.rb

require 'fileutils'
require 'yaml'

SRC_ROOT   = File.expand_path('~/novel-hwang/novel-list/output')
REPO       = File.expand_path(File.join(__dir__, '..'))
NOVEL_DIR  = File.join(REPO, '_novel')
DATA_FILE  = File.join(REPO, '_data', 'novels.yml')

abort "source not found: #{SRC_ROOT}" unless Dir.exist?(SRC_ROOT)

# Vietnamese-aware slug: strip diacritics, map đ, keep [a-z0-9-].
def slugify(str)
  str.unicode_normalize(:nfd)
     .gsub(/\p{Mn}/, '')
     .gsub(/[đĐ]/, 'd')
     .downcase
     .gsub(/[^a-z0-9]+/, '-')
     .gsub(/\A-+|-+\z/, '')
end

def yaml_str(str)
  '"' + str.gsub('\\', '\\\\').gsub('"', '\"') + '"'
end

def xml_escape(str)
  str.gsub('&', '&amp;').gsub('<', '&lt;').gsub('>', '&gt;')
     .gsub('"', '&quot;').gsub("'", '&apos;')
end

# Per-novel Atom feed. Front matter fixes the output path; the Liquid body
# resolves that novel's chapters at build time (newest first, capped) so the
# feed stays current without the ingest script re-running. `SITE` is hardcoded
# because _config.yml `url` omits the protocol.
SITE = 'https://hoang.tech'
def feed_source(slug, title, subtitle)
  base = "#{SITE}/novel/#{slug}/"
  <<~FEED
    ---
    layout: null
    permalink: /novel/#{slug}/feed.xml
    sitemap: false
    ---
    <?xml version="1.0" encoding="utf-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>#{xml_escape(title)}</title>
      <subtitle>#{xml_escape(subtitle)}</subtitle>
      <link href="#{base}feed.xml" rel="self" type="application/atom+xml"/>
      <link href="#{base}" rel="alternate" type="text/html"/>
      <id>#{base}</id>
      <updated>{{ site.time | date_to_xmlschema }}</updated>
      {%- assign chapters = site.novel | where: "novel", "#{slug}" | where_exp: "c", "c.chapter" | sort: "chapter" | reverse -%}
      {%- for c in chapters limit: 30 %}
      <entry>
        <title>{{ c.title | xml_escape }}</title>
        <link href="#{SITE}{{ c.url }}" rel="alternate" type="text/html"/>
        <id>#{SITE}{{ c.url }}</id>
        <updated>{{ site.time | date_to_xmlschema }}</updated>
      </entry>
      {%- endfor %}
    </feed>
  FEED
end

# Preserve curated fields from an existing novels.yml.
existing = {}
if File.exist?(DATA_FILE)
  (YAML.load_file(DATA_FILE) || []).each { |n| existing[n['slug']] = n }
end

FileUtils.mkdir_p(NOVEL_DIR)
novels = []

Dir.glob(File.join(SRC_ROOT, '*')).sort.each do |ndir|
  next unless File.directory?(ndir)
  chapters_dir = File.join(ndir, 'chapters')
  next unless Dir.exist?(chapters_dir)

  # ----- title + seed synopsis from premise.md -----
  title = File.basename(ndir)
  seed  = ''
  premise = File.join(ndir, 'premise.md')
  if File.exist?(premise)
    plines = File.readlines(premise, encoding: 'UTF-8')
    hidx = plines.index { |l| l =~ /\A#\s+/ }
    title = plines[hidx].sub(/\A#\s+/, '').strip if hidx
    body  = hidx ? plines[(hidx + 1)..-1] : plines
    seed  = (body.find { |l| !l.strip.empty? && !l.strip.start_with?('#') } || '').strip
  end
  slug = slugify(title)
  slug = File.basename(ndir) if slug.empty?

  out = File.join(NOVEL_DIR, slug)
  FileUtils.rm_rf(out)          # clean regenerate for this novel
  FileUtils.mkdir_p(out)

  # ----- chapters -----
  count = 0
  Dir.glob(File.join(chapters_dir, '*.md')).sort.each do |path|
    name = File.basename(path, '.md')
    next unless name =~ /\A\d+\z/
    num = name.to_i
    clines = File.readlines(path, encoding: 'UTF-8')
    cidx = clines.index { |l| l =~ /\A#\s+/ }
    if cidx
      ctitle = clines[cidx].sub(/\A#\s+/, '').strip
      cbody  = (clines[0...cidx] + clines[(cidx + 1)..-1]).join
    else
      ctitle = "Chương #{num}"
      cbody  = clines.join
    end
    fm = +"---\n"
    fm << "layout: novel\n"
    fm << "novel: #{slug}\n"
    fm << "novel_title: #{yaml_str(title)}\n"
    fm << "chapter: #{num}\n"
    fm << "title: #{yaml_str(ctitle)}\n"
    fm << "theme: reading\n"
    fm << "---\n\n"
    File.write(File.join(out, "#{name}.md"), fm + cbody.sub(/\A\s+/, ''))
    count += 1
  end

  # ----- per-novel landing (synopsis + its own TOC) -----
  ifm = +"---\n"
  ifm << "layout: novel-home\n"
  ifm << "novel: #{slug}\n"
  ifm << "permalink: /novel/#{slug}/\n"
  ifm << "title: #{yaml_str(title)}\n"
  ifm << "theme: reading\n"
  ifm << "sitemap: false\n"
  ifm << "---\n"
  File.write(File.join(out, 'index.html'), ifm)

  # ----- per-novel Atom feed (readers / Feedly discovery) -----
  prev = existing[slug] || {}
  subtitle = prev['tagline']
  subtitle = seed if subtitle.nil? || subtitle.empty?
  File.write(File.join(out, 'feed.xml'), feed_source(slug, title, subtitle))

  # ----- library metadata (preserve curated fields) -----
  novels << {
    'slug'     => slug,
    'title'    => title,
    'chapters' => count,
    'tagline'  => prev['tagline'] || '',
    'synopsis' => prev['synopsis'] || seed,
    'status'   => prev['status'] || 'Đang cập nhật',
  }
end

FileUtils.mkdir_p(File.dirname(DATA_FILE))
File.write(DATA_FILE, novels.to_yaml)
puts "processed #{novels.size} novel(s): " +
     novels.map { |n| "#{n['slug']} (#{n['chapters']} ch)" }.join(', ')
