'use strict';

import Youminer from './index';
import jsonfile from 'jsonfile';

Youminer.execute('zxh8rHm4FnM', result =>
	jsonfile.writeFile('./result.json', result)
);
