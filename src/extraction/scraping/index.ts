import { Page } from 'puppeteer'

import { openConnection, closeConnection } from './connection'
import { logger } from '../../common'

const removeDuplicates = (arr: any[]) => {
  return arr.filter((a, b) => arr.findIndex((elem) => elem === a) === b)
}

const removeItemOnce = (arr: any[], value: any) => {
  arr.splice(
    arr.findIndex(
      (v) =>
        v.headlinePortuguese === value.headlinePortuguese &&
        v.website === value.website
    ),
    1
  )
  return arr
}

const checkIfHeadlineIsOnline = (
  match: any,
  websiteName: string,
  onlineSentiments: any[]
) => {
  return (
    onlineSentiments.filter(
      (onlineSentiment) =>
        onlineSentiment.headlinePortuguese === match &&
        onlineSentiment.website === websiteName
    ).length > 0
  )
}

const cleanMatch = (match: any[]) => {
  const reQuote = new RegExp('&amp;#x27;', 'gm')
  const reDoubleQuote = new RegExp('&amp;quot;', 'gm')
  const reSpace = new RegExp('&nbsp;', 'gm')
  const reTags = new RegExp('<.*?>', 'gm')
  return match[2]
    .replace(reQuote, "'")
    .replace(reDoubleQuote, '"')
    .replace(reSpace, '"')
    .replace(reTags, ' ')
    .trim()
}

const getMatchObject = (
  keywords: string[],
  matches: IterableIterator<RegExpMatchArray>,
  websiteName: string,
  onlineSentiments: any[]
) => {
  const matchesArray = Array.from(matches)
  const matchObject = []

  const cleanedMatches = matchesArray.map((match) => cleanMatch(match))
  const deduplicatedMatches = removeDuplicates(cleanedMatches)

  for (const match of deduplicatedMatches) {
    const keywordsMatched = []
    if (checkIfHeadlineIsOnline(match, websiteName, onlineSentiments)) {
      removeItemOnce(onlineSentiments, {
        headlinePortuguese: match,
        website: websiteName,
      })
    } else {
      for (const keyword of keywords) {
        if (match.indexOf(keyword) >= 0) {
          keywordsMatched.push(keyword)
        }
      }
      if (keywordsMatched.length) {
        matchObject.push({
          keywords: keywordsMatched,
          headlinePortuguese: match,
        })
      }
    }
  }
  return removeDuplicates(matchObject)
}

const scrapeWebsite = async (
  page: Page,
  websiteName: string,
  website: string,
  regex: string,
  keywords: string[],
  onlineSentiments: any[]
) => {
  logger.info(`Scraping ${website}`)
  await page.goto(website, {
    waitUntil: 'domcontentloaded',
  })
  const websiteHtml = await page.content()
  const re = new RegExp(regex, 'gm')
  const matches = websiteHtml.matchAll(re)
  const matchObject = getMatchObject(
    keywords,
    matches,
    websiteName,
    onlineSentiments
  )

  logger.info(
    `Found ${matchObject.length} new match${matchObject.length > 1 ? 'es' : ''}`
  )
  return matchObject
}

export const scrape = async (
  websites: any[],
  keywords: string[],
  onlineSentiments: any[]
) => {
  logger.info('Starting websites scraping')

  const websiteMatches = []
  for (const website of websites) {
    for (let i = 0; i <= 3; i++) {
      try {
        const { page, browser } = await openConnection()
        const match = await scrapeWebsite(
          page,
          website.data.name,
          website.data.url,
          website.data.regex,
          keywords,
          onlineSentiments
        )
        websiteMatches.push({
          websiteName: website.data.name,
          websiteId: website.id,
          matches: match,
        })
        await closeConnection(page, browser)
        break
      } catch (err) {
        if (i === 3) {
          websiteMatches.push({
            websiteName: website.data.name,
            websiteId: website.id,
            matches: [],
          })
        }
        logger.info(`Fetching ${website.data.name}... retry ${i + 1} failed`)
      }
    }
  }
  return websiteMatches
}
