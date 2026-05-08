# Command Center

_Synopsis_ - The command center is a place were I can come to view all news that affects world wide markets. It allows me to make actionable insights into the world and make market predictions.



## Startup Sequence
> The startup sequence for how data should be grabbed and displayed when booting up the Command Center.

We want to make the opening of this app quick and easy. We want to populate the map with data we have already collected from the past.

While past data is being loaded as soon as we open the app. We start our sequence of pulling in fresh data, we want to look at what the most recent day is and pull data from the last time we opened the app till the current day. So for example if we last opened the app on 3/11 and it is 3/18 we pull data from the 3/12-3/18.

## Active Sequence
> API Clock Cycle - This is how often all of the APIs are triggered. Probably want a daily/half day/hourly/minutes

Our active sequence is what happens while we are operating the app. We will have a clock cycle were we call our APIs based on our limit. We will update our information in real-time as we are pulling it in.

## GUI
> The GUI will be how I interact with the information in the world.

I should be able to click on any country on the map to have news relating exclusively to that country pop up.

The main goal of the GUI is to have the simplest way for a human to ingest data and to be fluid in driving decisions to win in markets.



#### Country Pop-Up
> The country pop up is a window that will appear when you select a country. The map will zoom in on the country and have it centered on the left, while having the country pop up centered on the right.

The Country pop up is an informational window that shows more of what's going on specifically with that country. So for every respective market such as tech, manufacturing, insurance, etc. we will have a score as to how likely we can make an effective trade. 

**Score Color Codes:**

- Red -> Low score 50<=
- Yellow -> Medium score <50 and 75<= 
- Green -> Great score, we should take action 75< and 100<=
We will also have the category of market and a one sentence summary as to why the markets are or are not good for trading.

This will be a list that can go on for a while so scrolling inside of this box should be an option

If you click on one of the categories it will give you a more detailed summary as to what is going on with the market. We will also list all of the articles/context that we are using to come to this conclusion below the summarization. I'd also like to have a weighted score on the article to see how much it is contributing to the total assumption.

There should also be a plus button in the top right of this window to allow us to add all of the context to our chat on the right. 

If you click on any of the news articles/context it the pop up should show a summarization of the article and the reasons we believe this information is causing markets to move. It will also show specific reasons as to why the article is weighted as it is. We will also link the original article in case manual review is necessary

**Weight Calculation:**

- Max Possible Weight is 2.00
- Lowest Possible weight is 0.00
- Midpoint will be 1.00 as weight
The closer the weight is to 2 the more significance this article has to the markets. The closer to 0 the less impact this information has on the markets. The closer to 1 is that the article has impact but isn't the driving factor as to why the markets are behaving the way they are.



#### Filters
> This section is filtering for what shows up on the map

For Example:

- Type of news
- Disasters
- Financial Markets
- Continents that are focused
When we click on the filters we also want it to expand into a "pop-out" window. See (Figure) for how we want it.

The arrows and size of the filter pop-out will be dynamic as well. So for example if the Filters button is on the far left of the filter bar, the pop-out will pop up slightly to the right with the arrow still on the center of the filters button. Inverse if the filter button is on the right.

This doesn't happen though if the pop-out has enough room to have the arrow directly center of the button on the filters bar.



#### Arrows
> The arrows on the map detect news that has a potential effect on a country/continent.

This is to mainly just show the interactions between countries and visualize tension and other things.

If there are lots of interactions between a country we also want to make the color more neon. Less interactions can be a more matte color. Just want high-interactions to stick out more.

**Color Codes:**

- _Green_ -> Good positive correlation 
- _Yellow_ -> Unsure of the correlation
- _Red _-> Bad correlation


#### AI Chat Room
> This is how I interact with the predictive LLM. Purple is Chat bot and Blue is the user.

This chat room is how we plan out exactly how we are going to be making money from the markets. So this needs to be able to do a lot of cool things

I want to be able to create skills like just like heremes and openclaw that we can grow over time. We can invoke these skills with /"skill". 

I want to be able to scrape the web as well for other relevant information and have this done through the terminal on the right. There should also be a finalize skill that will output a plan of action for us to go and take care of. These plans of actions should be .md files that are stored in a special file. I should be able to reference them with a /update_plan "plan of action" so that I can update the chatbot history with the results of our trades so that we can learn more over time and properly weight articles and context.

This is a platform I want to have get smarter the longer we use it.



**Text Box**

This is where the user will interact with the LLM. We want this to be like the VScode CoPilot side chat so we will want to take inspo from this.

So we will be have a plus button to be able to add context aka the stores that we have in our DB. Countries can be context and I should be able to drop links where we can have context.



#### Stock Prices
> There will be the biggest indexes above the map and showing current market values. 



## Database
> This is where we will store our skills, articles, context, and other relevant information. This will be an SQLite DB

I don't have much experience creating relational DBs. But here are some things I want



#### Context/Articles
We should have a summarization of it, a weight, a link to the context, and any other relevant information.



#### Skills
We should have our md files here and that should probably be it



#### Chat Logs
We will store all of our chats, this is part of how we will develop our skills. We also want to store our plans in here plus whether or not our strategies failed or succeeded plus an after action report on our plan.

#### Other Stuff
This will be up to your discretion



