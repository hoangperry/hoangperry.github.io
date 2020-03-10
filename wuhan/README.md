#  Novel Coronavirus Infection Map

This repository stores the source code for the Novel Coronavirus Infection Map (https://hgis.uw.edu/virus). This online internactive map enables users to track both the global and local trends of Novel Coronavirus infection since Jan 21st, 2020. The dataset is timely collected from multiple official sources and then plotted opto this map.



![](img/interface1.png)

## Data Sources:
The data are mainly collected from a) [National Health Commission](http://en.nhc.gov.cn/) (NHC) of the People’s Republic of China; b) China’s Provincial & Municipal Health Commission; c) China’s Provincial & Municipal government database; d) Public data published from Hongkong, Macau and Taiwan official channels; e) [World Health Organization](https://www.who.int/emergencies/diseases/novel-coronavirus-2019/situation-reports/) (WHO), f) [Centers for Disease Control and Prevention](https://www.cdc.gov/coronavirus/) (CDC), g) [Public Health Agency of Canada](https://www.canada.ca/en/public-health.html) (PHA), h) [Baidu](https://voice.baidu.com/act/newpneumonia/newpneumonia), i)[Mapmiao](https://mapmiao.com/ncov/).

- The dataset (in SQLite format) can be dowloaded from http://hgis.uw.edu/virus/assets/virus.db.

- You can view the data (in CSV format) at http://hgis.uw.edu/virus/assets/virus.csv.

> **Note:** In the data table, each entry indicates the infection status in the format of `#-#-#-#` - a 4-sequel entry divided by dashes. The first sequel represents the number of confirmed cases, the second sequel represents suspected cases, the third sequel represents cured cases, the fourth sequel represents death cases.

## 	Update Procedure:

The country-level data is collected from WHO, while the data of each province in China is collected from multiple sources such as China's NHC, Mapmiao and Baidu. Notably, we also refer to CDC to verify the virus spreading status in the U.S. To make a timely data and map updates, we collect the data every 4 hours, and verify the data quality per day. In addition, we plan to provide finer-scale data from China (the county level), U.S. (the state level) and Canada (the province level) in the next version.

## Acknowledgement:

-  This map is made by the [Humanistic GIS Lab](https://hgis.uw.edu) at [University of Washington – Seattle](https://www.uw.edu).
- Team members: Bo Zhao (leader), Fengyu Xu, Lola Kang, Joshua Ji, and Steven Bao.
- The Server is hosted at [UW's Center for Studies in Demography and Ecology](https://csde.washington.edu/) (CSDE).
