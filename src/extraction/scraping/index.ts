import { Page } from 'puppeteer'

import { openConnection } from './connection'
import { logger } from '../../common'

const getMatchObject = (
  keywords: string[],
  matches: IterableIterator<RegExpMatchArray>
) => {
  const matchesArray = Array.from(matches)
  const matchObject = []
  for (const match of matchesArray) {
    const re = new RegExp('<.*?>', 'gm')
    const trimmedMatch = match[2].trim().replace(re, ' ')
    const keywordsMatched = []
    for (const keyword of keywords) {
      if (trimmedMatch.indexOf(keyword) >= 0) {
        keywordsMatched.push(keyword)
      }
    }
    if (keywordsMatched.length) {
      matchObject.push({
        keywords: keywordsMatched,
        headline: trimmedMatch,
      })
    }
  }
  return matchObject
}

const scrapeWebsite = async (
  page: Page,
  website: string,
  regex: string,
  keywords: string[]
) => {
  logger.info(`Scraping ${website}`)
  await page.goto(website, {
    waitUntil: 'domcontentloaded',
  })
  const websiteHtml = await page.content()
  const re = new RegExp(regex, 'gm')
  const matches = websiteHtml.matchAll(re)
  const matchObject = getMatchObject(keywords, matches)

  logger.info(
    `Found matches for ${matchObject.length} keyword${
      matchObject.length > 1 ? 's' : ''
    }`
  )
  return matchObject
}

export const scrape = async (websiteDocs: any[], keywords: string[]) => {
  logger.info('Starting websites scraping')
  const { page } = await openConnection()

  const websiteMatches = []
  for (const websiteDoc of websiteDocs) {
    const match = await scrapeWebsite(
      page,
      websiteDoc.data.url,
      websiteDoc.data.regex,
      keywords
    )
    websiteMatches.push({
      websiteName: websiteDoc.data.name,
      websiteId: websiteDoc.id,
      matches: match,
    })
  }
  return websiteMatches
}
