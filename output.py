from otree_markets.output import BaseCSVMarketOutputGenerator, DefaultJSONMarketOutputGenerator

class AllocationCsvGenerator(BaseCSVMarketOutputGenerator):
    def get_header(self):
        '''this method should return a list of strings which will form the csv's header
        '''
        my_list = []
        for subsession in self.session.get_subsessions():
            config = subsession.config
            if subsession.round_number > config.num_rounds:
                continue

            for group in subsession.get_groups():
                num_players = len(group.get_players())
                my_list.append(num_players)


        max_number = max(my_list)
        header = ['round_number', 'group_id', 'timestamp']
        for player_number in range(1,max_number+1):
            header.append('p'+str(player_number) + 'x')
            header.append('p'+str(player_number)+'y')
        
        return header

        # raise NotImplementedError()
        
    
    def get_group_output(self, group):
        '''this method should be a generator which yields one list of values for each row in the csv


        it's called once for each group object in the selected session. that group object is passed in as the 'group'
        parameter.
        '''
        config = group.subsession.config
        if group.round_number > config.num_rounds:
            return

        start_time = group.get_start_time()

        trades = group.exchanges.get().trades.all()

        player_data = {}

        for player in group.get_players():
            player_data[player.participant.code] = [player.config.x_endowment, player.config.y_endowment]

        x = list(player_data)

        my_List = [[group.round_number,
                group.id_in_subsession,
                0,]]
        for i in range(len(group.get_players())):
            l = [
                player_data[x[i]][0],
                player_data[x[i]][1],
            ]
            my_List.append(l)

        yield[
            j for i in my_List for j in i              

        ]

        for trade in trades:
            taking_order = trade.taking_order
            for making_order in trade.making_orders.all():
                price = (making_order.price)/(config.y_currency_scale/config.x_currency_scale)
                volume = (making_order.traded_volume)/(config.x_currency_scale)
                if (making_order.pcode in str(player_data.keys())):
                    # print('Making order is: ', making_order.pcode, )
                    if (making_order.is_bid):
                        player_data[making_order.pcode][0] += volume
                        player_data[making_order.pcode][1]-= price*volume
                        # print('player pcode is:', player_data[making_order.pcode])
                    else: 
                        player_data[making_order.pcode][0] -= volume
                        player_data[making_order.pcode][1]+= price*volume

                if (taking_order.pcode in str(player_data.keys())):
                    if (taking_order.is_bid):
                        player_data[taking_order.pcode][0] += volume
                        player_data[taking_order.pcode][1]-= price*volume
                    else: 
                        player_data[taking_order.pcode][0] -= volume
                        player_data[taking_order.pcode][1]+= price*volume

            x = list(player_data)
            my_List2 = [[group.round_number,
                        group.id_in_subsession,
                        (trade.timestamp-start_time).total_seconds()]]

            for k in range(len(group.get_players())):
                l = [
                    player_data[x[k]][0],
                    player_data[x[k]][1],
                ]
                my_List2.append(l)

            yield[
                j for k in my_List2 for j in k              

            ]
        # print(player_data)

        # raise NotImplementedError()

output_generators = [AllocationCsvGenerator, DefaultJSONMarketOutputGenerator]
