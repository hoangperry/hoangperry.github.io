#!/usr/bin/env ruby
# frozen_string_literal: true
#
# Generate the `_novel` Jekyll collection from the novel-pipeline output.
# For each source chapter (chapters/NN.md) it extracts the title from the
# leading "# ..." heading, then writes _novel/NN.md with reading front matter
# and the prose (heading removed, since the layout renders the title).
#
# Idempotent: safe to re-run; it overwrites _novel/*.md.
#
#   ruby scripts/ingest-novel.rb

require 'fileutils'

SRC  = File.expand_path('~/novel-hwang/novel-list/output/novel/chapters')
DEST = File.expand_path(File.join(__dir__, '..', '_novel'))

abort "source not found: #{SRC}" unless Dir.exist?(SRC)
FileUtils.mkdir_p(DEST)

count = 0
Dir.glob(File.join(SRC, '*.md')).sort.each do |path|
  name = File.basename(path, '.md')      # "01" .. "144"
  next unless name =~ /\A\d+\z/          # numeric chapters only
  num = name.to_i

  lines = File.readlines(path, encoding: 'UTF-8')
  hidx  = lines.index { |l| l =~ /\A#\s+/ }
  if hidx
    title = lines[hidx].sub(/\A#\s+/, '').strip
    body  = (lines[0...hidx] + lines[(hidx + 1)..-1]).join
  else
    title = "Chương #{num}"
    body  = lines.join
  end

  title_yaml = title.gsub('"', '\"')     # safe inside a double-quoted YAML scalar
  front = +"---\n"
  front << "layout: novel\n"
  front << "chapter: #{num}\n"
  front << "title: \"#{title_yaml}\"\n"
  front << "theme: reading\n"
  front << "---\n\n"

  File.write(File.join(DEST, "#{name}.md"), front + body.sub(/\A\s+/, ''))
  count += 1
end

puts "wrote #{count} chapters to #{DEST}"
