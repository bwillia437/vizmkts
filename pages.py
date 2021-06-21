from otree.api import Page, WaitPage
from otree_markets.pages import BaseMarketPage
from .models import Constants

class Market(BaseMarketPage):

    def is_displayed(self):
        return self.round_number <= self.subsession.config.num_rounds
    
    def vars_for_template(self):
        config = self.player.config
        x_bounds = [x * config.x_currency_scale for x in config.x_bounds]
        y_bounds = [y * config.y_currency_scale for y in config.y_bounds]

        return {
            'config': config,
            'x_bounds': x_bounds,
            'y_bounds': y_bounds,
        }

class PracticeRoundPauseScreen(Page):

    def is_displayed(self):
        return self.round_number <= self.subsession.config.num_rounds and self.subsession.config.is_practice

class PostRoundWaitPage(WaitPage):

    after_all_players_arrive = 'set_payoffs'

    def is_displayed(self):
        return self.round_number <= self.subsession.config.num_rounds and not self.subsession.config.is_practice

class Results(Page):

    def is_displayed(self):
        return self.round_number == Constants.num_rounds
    
    def vars_for_template(self):
        return {
            'total_unscaled_payoff': float(self.player.participant.payoff) / 1000
        }

page_sequence = [Market, PracticeRoundPauseScreen, PostRoundWaitPage, Results]
