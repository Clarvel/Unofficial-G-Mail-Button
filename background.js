const GMAIL_URL = "https://mail.google.com/mail/"
const FEED_URL = GMAIL_URL + "feed/atom"
const QUERY_URL = GMAIL_URL + "*"
const COUNT_REGEX = /<fullcount>(.*)<\/fullcount>/
const COUNT_KEY = "count"
const FAILS_KEY = "failures"
const MIN_RETRY = 5
const MAX_RETRY = 60

var browser = browser ?? chrome


async function Get(key){
    return (await browser.storage.sync.get(key))[key]
}

function UpdateIcon(count) {
    if(count == null){
        browser.action.setBadgeBackgroundColor({color:[190, 190, 190, 230]})
        browser.action.setBadgeText({text:"?"})
    }else{
        browser.action.setBadgeBackgroundColor({color:[208, 0, 24, 255]})
        browser.action.setBadgeText({text:count})
    }
}

async function Update(){
    let fails = 0
    let count = undefined
    try{
        count = (await (await fetch(FEED_URL, {credentials: "include"})).text()).match(COUNT_REGEX)?.[1] ?? ''
    }catch(e){
        console.warn(e)
        fails = (await Get(FAILS_KEY) ?? 0) + 1
    }   
    await browser.storage.sync.set({[COUNT_KEY]:count, [FAILS_KEY]:fails})
    const delay = Math.min(Math.max(MIN_RETRY, MIN_RETRY * fails), MAX_RETRY)
    browser.alarms.create(undefined, {periodInMinutes: delay})
}

function ResetFails(){
    return browser.storage.sync.set({[FAILS_KEY]: 0}) // set fails counter to 0 on install and startup
}

browser.action.onClicked.addListener(async () => {
    const tab = (await browser.tabs.query({url: QUERY_URL}))[0]
    tab ? browser.tabs.update(tab.id, {highlighted: true}) : browser.tabs.create({url: GMAIL_URL})
    // opening in new tab triggers tab update listener, so dont duplicate update call here
})

browser.storage.onChanged.addListener((changes, _) => {
    const countObj = changes[COUNT_KEY]
    if(countObj){
        UpdateIcon(countObj.newValue)
    }
})

browser.tabs.onUpdated.addListener((_, details) => {
    if(details.url && details.url.indexOf(GMAIL_URL) === 0){
        Update()
    }
})

browser.runtime.onInstalled.addListener(ResetFails)

browser.alarms.onAlarm.addListener(Update)

browser.runtime.onStartup.addListener(async () => {
    await ResetFails()
    await Update()
})

Get(COUNT_KEY).then(UpdateIcon)